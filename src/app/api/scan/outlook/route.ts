/**
 * POST /api/scan/outlook
 *
 * Outlook email scanning with:
 * - Manual scan: last 7 days, max 200 emails
 * - Daily cron: last 24 hours, max 100 emails
 * - Background self-chain: continues even if user closes tab
 * - Push notification on completion via sw.js
 *
 * MIGRATION REQUIRED (run once in Supabase SQL editor):
 *   ALTER TABLE outlook_accounts ADD COLUMN IF NOT EXISTS scan_locked_until timestamptz;
 *
 * File: src/app/api/scan/outlook/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAuthUserId } from '@/lib/auth'
import { getValidOutlookToken } from '@/lib/outlook-tokens'
import {
  fetchEmails,
  fetchAttachments,
  toUnifiedEmail,
} from '@/lib/microsoft-graph'
import { classifyEmail, extractBillFromEmail } from '@/lib/ai'
import { lookupVendor } from '@/lib/vendor-lookup'
import { detectIncassoAgency } from '@/lib/incasso-detect'
import { sendPushToUser } from '@/lib/push'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── LIMITS ──────────────────────────────────────────────────────
const MAX_EMAILS_MANUAL = 200
const MAX_EMAILS_DAILY = 100
const MANUAL_SCAN_DAYS = 7
const DAILY_SCAN_HOURS = 24
const LOCK_DURATION_MS = 90_000 // 90s lock per batch

interface ScanRequest {
  accountId: string
  batchSize?: number
  isDailyScan?: boolean
  _background?: boolean  // set by self-chain, not by client
  _userId?: string       // set by self-chain, not by client
}

export async function POST(request: NextRequest) {
  try {
    const body: ScanRequest = await request.json()
    const {
      accountId,
      batchSize = 15,
      isDailyScan = false,
      _background = false,
      _userId,
    } = body

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is vereist' }, { status: 400 })
    }

    // ─── Auth: client session OR background self-chain ─────────
    let userId: string

    if (_background && _userId) {
      // Background self-invocation: verify scan is actually in progress
      const supabaseCheck = createServiceRoleClient()
      const { data: check } = await supabaseCheck
        .from('outlook_accounts')
        .select('user_id, scan_cursor')
        .eq('id', accountId)
        .single()

      if (!check || check.user_id !== _userId || !check.scan_cursor) {
        return NextResponse.json({ complete: true }, { status: 200 })
      }
      userId = _userId
    } else {
      const authUserId = await getAuthUserId()
      if (!authUserId) {
        return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
      }
      userId = authUserId
    }

    const tokenResult = await getValidOutlookToken(accountId, userId)
    if (!tokenResult) {
      return NextResponse.json(
        { error: 'Outlook account vereist opnieuw inloggen', needs_reauth: true },
        { status: 401 }
      )
    }

    const { accessToken } = tokenResult
    const supabase = createServiceRoleClient()

    // ─── Load account state ────────────────────────────────────
    const { data: account } = await supabase
      .from('outlook_accounts')
      .select('scan_cursor, scan_progress, full_scan_complete, last_scanned, scan_locked_until')
      .eq('id', accountId)
      .single()

    // ─── Lock check: prevent double-processing ─────────────────
    const lockExpiry = account?.scan_locked_until ? new Date(account.scan_locked_until) : null
    if (lockExpiry && lockExpiry > new Date()) {
      // Another invocation is actively processing — return current progress
      return NextResponse.json({
        processed: 0,
        bills_found: 0,
        scan_progress: account?.scan_progress || 0,
        max_emails: isDailyScan ? MAX_EMAILS_DAILY : MAX_EMAILS_MANUAL,
        complete: false,
        locked: true,
      })
    }

    const maxEmails = isDailyScan ? MAX_EMAILS_DAILY : MAX_EMAILS_MANUAL
    const currentProgress = account?.scan_progress || 0

    // ─── Hard cap reached ──────────────────────────────────────
    if (currentProgress >= maxEmails) {
      await supabase
        .from('outlook_accounts')
        .update({
          last_scanned: new Date().toISOString(),
          scan_cursor: null,
          scan_progress: 0,
          scan_locked_until: null,
        })
        .eq('id', accountId)

      sendPushToUser(userId, {
        title: 'Scan voltooid ✅',
        body: `${currentProgress} e-mails gescand.`,
        tag: 'paywatch-scan-complete',
        url: '/betalingen',
      }).catch(() => {})

      return NextResponse.json({
        processed: 0, bills_found: 0, remaining: 0,
        scan_progress: currentProgress, max_emails: maxEmails,
        complete: true,
      })
    }

    // ─── Acquire lock ──────────────────────────────────────────
    await supabase
      .from('outlook_accounts')
      .update({ scan_locked_until: new Date(Date.now() + LOCK_DURATION_MS).toISOString() })
      .eq('id', accountId)

    // ─── Determine date filter ─────────────────────────────────
    let sinceDate: string

    if (isDailyScan) {
      sinceDate = new Date(Date.now() - DAILY_SCAN_HOURS * 60 * 60 * 1000).toISOString()
    } else if (account?.scan_cursor) {
      sinceDate = '' // Cursor has context
    } else if (account?.last_scanned && account?.full_scan_complete) {
      sinceDate = account.last_scanned
    } else {
      sinceDate = new Date(Date.now() - MANUAL_SCAN_DAYS * 24 * 60 * 60 * 1000).toISOString()
    }

    const remainingAllowed = maxEmails - currentProgress
    const effectiveBatchSize = Math.min(batchSize, remainingAllowed)

    // ─── Fetch emails from Microsoft Graph ─────────────────────
    const { messages, nextLink } = await fetchEmails(accessToken, {
      sinceDate: sinceDate || undefined,
      top: effectiveBatchSize,
      nextLink: account?.scan_cursor || undefined,
    })

    if (!messages.length) {
      await supabase
        .from('outlook_accounts')
        .update({
          last_scanned: new Date().toISOString(),
          full_scan_complete: true,
          scan_cursor: null,
          scan_progress: 0,
          scan_locked_until: null,
        })
        .eq('id', accountId)

      sendPushToUser(userId, {
        title: 'Scan voltooid ✅',
        body: `${currentProgress} e-mails gescand. Geen nieuwe e-mails.`,
        tag: 'paywatch-scan-complete',
        url: '/betalingen',
      }).catch(() => {})

      return NextResponse.json({
        processed: 0, bills_found: 0, remaining: 0,
        scan_progress: currentProgress, max_emails: maxEmails,
        complete: true,
      })
    }

    // ─── Process batch ─────────────────────────────────────────
    let billsFound = 0
    let processed = 0

    for (const msg of messages) {
      processed++

      // Dedup
      const { data: existing } = await supabase
        .from('scan_processed')
        .select('gmail_message_id')
        .eq('user_id', userId)
        .eq('gmail_message_id', msg.id)
        .eq('provider', 'outlook')
        .maybeSingle()

      if (existing) continue

      const unified = toUnifiedEmail(msg)
      const bodySnippet = (unified.bodyText || unified.bodyHtml || '').slice(0, 500)

      // ✅ classifyEmail(subject, sender, body, userId) — 4 positional args
      const classification = await classifyEmail(
        unified.subject,
        unified.fromEmail,
        bodySnippet,
        userId
      )

      if (!classification.is_bill) {
        await supabase.from('scan_processed').insert({
          user_id: userId, gmail_message_id: msg.id, provider: 'outlook',
        })
        continue
      }

      // Download PDF if present
      let pdfText: string | null = null
      if (msg.hasAttachments) {
        const attachments = await fetchAttachments(accessToken, msg.id)
        const pdf = attachments.find(
          (a: { contentType: string }) => a.contentType === 'application/pdf'
        )
        if (pdf?.contentBytes) {
          try {
            const decoded = Buffer.from(pdf.contentBytes, 'base64').toString('utf-8')
            // Only use if it contains readable text (not binary PDF)
            if (decoded && !/[\x00-\x08\x0E-\x1F]/.test(decoded.slice(0, 200))) {
              pdfText = decoded
            }
          } catch {
            // Binary PDF — extraction will use email body instead
          }
        }
      }

      const fullBody = unified.bodyHtml || unified.bodyText || ''

      // ✅ extractBillFromEmail(subject, body, pdfText, userId) — 4 positional args
      const billData = await extractBillFromEmail(
        unified.subject,
        fullBody,
        pdfText,
        userId
      )

      if (!billData) {
        await supabase.from('scan_processed').insert({
          user_id: userId, gmail_message_id: msg.id, provider: 'outlook',
        })
        continue
      }

      // ✅ lookupVendor is async — must await
      const vendorMatch = await lookupVendor(billData.vendor)
      if (vendorMatch) {
        billData.category_hint = vendorMatch.category
      }

      // ✅ detectIncassoAgency (NOT detectIncasso)
      // ✅ .matched (NOT .isIncasso), .agency_name (NOT .agencyName)
      const incassoResult = await detectIncassoAgency(billData.vendor)
      if (incassoResult.matched) {
        ;(billData as any).is_incasso = true
        ;(billData as any).incasso_agency = incassoResult.agency_name
      }

      // Dedup hash
      const hash = generateBillHash(billData)
      const { data: dupCheck } = await supabase
        .from('bills')
        .select('id')
        .eq('user_id', userId)
        .eq('hash', hash)
        .maybeSingle()

      if (dupCheck) {
        await supabase.from('scan_processed').insert({
          user_id: userId, gmail_message_id: msg.id, provider: 'outlook',
        })
        continue
      }

      // Insert bill
      const { error: insertError } = await supabase.from('bills').insert({
        id: generateNanoid(),
        user_id: userId,
        vendor: billData.vendor,
        amount: billData.amount_cents,
        currency: billData.currency || 'EUR',
        iban_encrypted: billData.iban ? encrypt(billData.iban) : null,
        reference: billData.reference,
        due_date: billData.due_date || new Date().toISOString().split('T')[0],
        received_date: billData.received_date || unified.receivedDate.split('T')[0],
        category: billData.category_hint || 'overig',
        status: billData.due_date && new Date(billData.due_date) < new Date() ? 'action' : 'outstanding',
        source: 'outlook_scan',
        outlook_message_id: msg.id,
        outlook_account_id: accountId,
        hash,
        payment_url: billData.payment_url,
        requires_review: (billData.confidence?.amount || 0) < 0.7,
      })

      if (!insertError) billsFound++

      await supabase.from('scan_processed').insert({
        user_id: userId, gmail_message_id: msg.id, provider: 'outlook',
      })
    }

    // ─── Update progress + release lock ────────────────────────
    const newProgress = currentProgress + processed
    const hitLimit = newProgress >= maxEmails
    const isComplete = !nextLink || hitLimit

    await supabase
      .from('outlook_accounts')
      .update({
        scan_progress: isComplete ? 0 : newProgress,
        scan_cursor: isComplete ? null : (nextLink || null),
        last_scanned: new Date().toISOString(),
        full_scan_complete: isComplete,
        scan_locked_until: null,
      })
      .eq('id', accountId)

    // ─── Push notification on completion ───────────────────────
    if (isComplete) {
      sendPushToUser(userId, {
        title: 'Scan voltooid ✅',
        body: `${newProgress} e-mails gescand, ${billsFound} rekening${billsFound !== 1 ? 'en' : ''} gevonden.`,
        tag: 'paywatch-scan-complete',
        url: '/betalingen',
      }).catch(() => {})
    }

    // ─── Background self-chain ─────────────────────────────────
    // If not complete, fire a request to self so scan continues
    // even if user closes the tab. The lock prevents double-processing.
    if (!isComplete) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'
      fetch(`${appUrl}/api/scan/outlook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          batchSize,
          isDailyScan,
          _background: true,
          _userId: userId,
        }),
      }).catch(() => {
        // Self-chain failed — client picks up if still open,
        // otherwise scan resumes on next visit (cursor saved in DB)
      })
    }

    return NextResponse.json({
      processed,
      bills_found: billsFound,
      remaining: isComplete ? 0 : 'more',
      scan_progress: newProgress,
      max_emails: maxEmails,
      complete: isComplete,
      hit_limit: hitLimit,
    })
  } catch (error) {
    console.error('[Outlook Scan] Error:', error)

    // Release lock on error
    try {
      const errBody = await request.clone().json().catch(() => ({}))
      if (errBody.accountId) {
        const supabase = createServiceRoleClient()
        await supabase
          .from('outlook_accounts')
          .update({ scan_locked_until: null })
          .eq('id', errBody.accountId)
      }
    } catch { /* best effort */ }

    return NextResponse.json(
      { error: 'Er ging iets mis bij het scannen' },
      { status: 500 }
    )
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function generateBillHash(data: any): string {
  const { createHash } = require('crypto')
  const raw = `${data.vendor}|${data.amount_cents}|${data.due_date || ''}|${data.reference || ''}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

function generateNanoid(): string {
  const { randomBytes } = require('crypto')
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
  const bytes = randomBytes(12)
  return Array.from(bytes)
    .map((b: number) => alphabet[b % alphabet.length])
    .join('')
}

function encrypt(plaintext: string): string {
  const { encrypt: enc } = require('@/lib/encryption')
  return enc(plaintext)
}
