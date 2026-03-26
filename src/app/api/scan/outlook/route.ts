/**
 * POST /api/scan/outlook
 * 
 * FIXED: Correct imports + date limits + email cap + push notification on complete.
 * - Manual scan (first time): last 7 days, max 200 emails
 * - Manual scan (returning user): since last scan, max 200 emails
 * - Daily cron: last 24 hours, max 100 emails
 * - Sends push notification when scan finishes (works even if user switched tabs)
 * 
 * File: src/app/api/scan/outlook/route.ts
 * 
 * CHANGES from broken version:
 *   1. extractBillData → extractBillFromEmail (correct export name)
 *   2. detectIncasso → detectIncassoAgency (correct export name)
 *   3. .isIncasso → .matched (correct IncassoMatch property)
 *   4. .agencyName → .agency_name (correct IncassoMatch property)
 *   5. Added sendPushToUser on scan completion
 *   6. lookupVendor now awaited (it's async)
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

// ✅ FIXED: correct export names
import { classifyEmail, extractBillFromEmail } from '@/lib/ai/pipeline'
import { lookupVendor } from '@/lib/vendor-lookup'
import { detectIncassoAgency } from '@/lib/incasso-detect'
import { sendPushToUser } from '@/lib/push'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── LIMITS ──────────────────────────────────────────────────────
const MAX_EMAILS_MANUAL = 200   // Hard cap for manual scan
const MAX_EMAILS_DAILY = 100    // Hard cap for daily/cron scan
const MANUAL_SCAN_DAYS = 7      // Manual scan: last 7 days
const DAILY_SCAN_HOURS = 24     // Daily scan: last 24 hours

interface ScanRequest {
  accountId: string
  batchSize?: number
  isDailyScan?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const body: ScanRequest = await request.json()
    const { accountId, batchSize = 15, isDailyScan = false } = body

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is vereist' }, { status: 400 })
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

    const { data: account } = await supabase
      .from('outlook_accounts')
      .select('scan_cursor, scan_progress, full_scan_complete, last_scanned')
      .eq('id', accountId)
      .single()

    // ─── Determine date filter and max emails ──────────────────
    const maxEmails = isDailyScan ? MAX_EMAILS_DAILY : MAX_EMAILS_MANUAL
    const currentProgress = account?.scan_progress || 0

    // HARD CAP: If we've already processed enough emails this scan session, stop
    if (currentProgress >= maxEmails) {
      await supabase
        .from('outlook_accounts')
        .update({
          last_scanned: new Date().toISOString(),
          scan_cursor: null,
          scan_progress: 0,
        })
        .eq('id', accountId)

      return NextResponse.json({
        processed: 0,
        bills_found: 0,
        remaining: 0,
        scan_progress: currentProgress,
        max_emails: maxEmails,
        complete: true,
        message: `Limiet bereikt: ${currentProgress} e-mails gescand`,
      })
    }

    let sinceDate: string

    if (isDailyScan) {
      const since = new Date(Date.now() - DAILY_SCAN_HOURS * 60 * 60 * 1000)
      sinceDate = since.toISOString()
    } else if (account?.scan_cursor) {
      sinceDate = '' // Will use cursor instead
    } else if (account?.last_scanned && account?.full_scan_complete) {
      sinceDate = account.last_scanned
    } else {
      const sevenDaysAgo = new Date(Date.now() - MANUAL_SCAN_DAYS * 24 * 60 * 60 * 1000)
      sinceDate = sevenDaysAgo.toISOString()
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
        })
        .eq('id', accountId)

      // Push notification: scan complete (no new emails found)
      sendPushToUser(userId, {
        title: 'Scan voltooid ✅',
        body: `${currentProgress} e-mails gescand. Geen nieuwe e-mails gevonden.`,
        tag: 'paywatch-scan-complete',
        url: '/betalingen',
      }).catch(() => {}) // fire-and-forget

      return NextResponse.json({
        processed: 0,
        bills_found: 0,
        remaining: 0,
        scan_progress: currentProgress,
        max_emails: maxEmails,
        complete: true,
      })
    }

    // ─── Process batch through AI pipeline ─────────────────────
    let billsFound = 0
    let processed = 0

    for (const msg of messages) {
      processed++

      // Check dedup
      const { data: existing } = await supabase
        .from('scan_processed')
        .select('gmail_message_id')
        .eq('user_id', userId)
        .eq('gmail_message_id', msg.id)
        .eq('provider', 'outlook')
        .maybeSingle()

      if (existing) continue

      const unified = toUnifiedEmail(msg)

      // Classify
      const classification = await classifyEmail({
        subject: unified.subject,
        from: unified.from,
        fromEmail: unified.fromEmail,
        bodySnippet: (unified.bodyText || unified.bodyHtml || '').slice(0, 500),
      })

      if (!classification.is_bill) {
        await supabase.from('scan_processed').insert({
          user_id: userId,
          gmail_message_id: msg.id,
          provider: 'outlook',
        })
        continue
      }

      // PDF attachments
      let pdfBase64: string | undefined
      if (msg.hasAttachments) {
        const attachments = await fetchAttachments(accessToken, msg.id)
        const pdfAttachment = attachments.find(
          (a: { contentType: string }) => a.contentType === 'application/pdf'
        )
        if (pdfAttachment) {
          pdfBase64 = pdfAttachment.contentBytes
        }
      }

      // ✅ FIXED: extractBillData → extractBillFromEmail
      const extractionInput = pdfBase64
        ? { pdf: pdfBase64, source: 'outlook_scan' as const }
        : {
            emailBody: unified.bodyHtml || unified.bodyText,
            subject: unified.subject,
            from: unified.fromEmail,
            source: 'outlook_scan' as const,
            vendorContext: true,
          }

      const billData = await extractBillFromEmail(extractionInput)

      if (!billData) {
        await supabase.from('scan_processed').insert({
          user_id: userId,
          gmail_message_id: msg.id,
          provider: 'outlook',
        })
        continue
      }

      // ✅ FIXED: await added (async function)
      const vendorMatch = await lookupVendor(billData.vendor)
      if (vendorMatch) {
        billData.category = vendorMatch.category
      }

      // ✅ FIXED: detectIncasso → detectIncassoAgency
      // ✅ FIXED: .isIncasso → .matched, .agencyName → .agency_name
      const incassoResult = await detectIncassoAgency(billData.vendor)
      if (incassoResult.matched) {
        billData.is_incasso = true
        billData.incasso_agency = incassoResult.agency_name
      }

      // Dedup hash check
      const hash = generateBillHash(billData)
      const { data: dupCheck } = await supabase
        .from('bills')
        .select('id')
        .eq('user_id', userId)
        .eq('hash', hash)
        .maybeSingle()

      if (dupCheck) {
        await supabase.from('scan_processed').insert({
          user_id: userId,
          gmail_message_id: msg.id,
          provider: 'outlook',
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
        received_date: unified.receivedDate.split('T')[0],
        category: billData.category || 'overig',
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
        user_id: userId,
        gmail_message_id: msg.id,
        provider: 'outlook',
      })
    }

    // ─── Update scan progress ──────────────────────────────────
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
      })
      .eq('id', accountId)

    // ─── Push notification on scan completion ──────────────────
    if (isComplete) {
      sendPushToUser(userId, {
        title: 'Scan voltooid ✅',
        body: `${newProgress} e-mails gescand, ${billsFound} rekening${billsFound !== 1 ? 'en' : ''} gevonden.`,
        tag: 'paywatch-scan-complete',
        url: '/betalingen',
      }).catch(() => {}) // fire-and-forget, don't block response
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
    return NextResponse.json(
      { error: 'Er ging iets mis bij het scannen' },
      { status: 500 }
    )
  }
}

// ─── Helper functions ────────────────────────────────────────────

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
