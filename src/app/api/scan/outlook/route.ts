/**
 * POST /api/scan/outlook
 *
 * Outlook email scanning with:
 * - Keyword pre-filter: skips obvious non-bills BEFORE AI (free + instant)
 * - Manual scan: last 7 days, max 200 emails
 * - Daily cron: last 24 hours, max 100 emails
 * - Background self-chain: continues even if user closes tab
 * - Push notification on completion via sw.js
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

// ─── KEYWORD PRE-FILTER ─────────────────────────────────────────
// Two layers:
// 1. Static keywords: bill-related LANGUAGE (factuur, betaling, etc.)
// 2. Dynamic keywords: loaded from DB at scan start (561 vendor + incasso names)
// Combined check takes <1ms even with 700+ keywords.
const BILL_LANGUAGE_KEYWORDS = [
  // Dutch bill/invoice terms
  'factuur', 'rekening', 'nota', 'invoice', 'betaling', 'payment',
  'te betalen', 'openstaand', 'verschuldigd', 'totaalbedrag',
  // Reminders & escalation
  'herinnering', 'aanmaning', 'reminder', 'sommatie', 'ingebrekestelling',
  'laatste waarschuwing', 'betalingsachterstand',
  // Collection & legal
  'incasso', 'deurwaarder', 'vordering', 'gerechtsdeurwaarder',
  'dagvaarding', 'beslag', 'executie', 'automatische incasso',
  // Payment arrangement
  'betalingsregeling', 'termijnbetaling', 'aflossing', 'schuld',
  // Payment details
  'iban', 'bankrekeningnummer', 'overmaken naar', 'betaalinformatie',
  'vervaldatum', 'uiterlijk betalen', 'due date', 'betaal voor',
  'betalingskenmerk', 'kenmerk', 'factuurnummer', 'dossiernummer',
  // Amount indicators (no € or euro — too many false positives from ads)
  'bedrag', 'te voldoen',
  // Common bill sender patterns
  'no-reply', 'noreply', 'billing', 'finance', 'administratie',
  'boekhouding', 'debiteuren',
  // Utilities & services
  'energienota', 'jaarnota', 'maandnota', 'termijnbedrag',
  'zorgverzekering', 'premie', 'polis', 'voorschotbedrag',
  // Government
  'belastingdienst', 'cjib', 'duo', 'toeslagen', 'gemeente',
  'waterschapsbelasting', 'motorrijtuigenbelasting', 'svb', 'uwv', 'cak',
];

/**
 * Load all 561 vendor + incasso names from DB (runs once per scan batch).
 * Query takes ~50ms. Results cached for the batch duration.
 */
async function loadVendorKeywords(supabase: ReturnType<typeof createServiceRoleClient>): Promise<string[]> {
  try {
    const [vendorResult, incassoResult] = await Promise.all([
      supabase.from('vendor_category_map').select('vendor_pattern'),
      supabase.from('incasso_agencies').select('search_name'),
    ]);

    const vendorNames = (vendorResult.data || [])
      .map((v: { vendor_pattern: string }) => v.vendor_pattern.toLowerCase())
      .filter((n: string) => n.length > 3); // Skip short patterns (NS, CZ etc.) — too many false positives in email text

    const incassoNames = (incassoResult.data || [])
      .map((a: { search_name: string }) => a.search_name.toLowerCase())
      .filter((n: string) => n.length > 3);

    return [...vendorNames, ...incassoNames];
  } catch {
    console.warn('[Outlook Scan] Failed to load vendor keywords from DB, using language keywords only');
    return [];
  }
}

function mightBeBill(subject: string, sender: string, bodySnippet: string, vendorKeywords: string[]): boolean {
  const combined = `${subject} ${sender} ${bodySnippet}`.toLowerCase();

  // Check bill language keywords
  if (BILL_LANGUAGE_KEYWORDS.some(keyword => combined.includes(keyword))) return true;

  // Check vendor + incasso names from DB
  if (vendorKeywords.some(name => combined.includes(name))) return true;

  return false;
}

interface ScanRequest {
  accountId: string
  batchSize?: number
  isDailyScan?: boolean
  _background?: boolean
  _userId?: string
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

    // ─── Load account state + vendor keywords in parallel ──────
    const [accountResult, vendorKeywords] = await Promise.all([
      supabase
        .from('outlook_accounts')
        .select('scan_cursor, scan_progress, full_scan_complete, last_scanned, scan_locked_until')
        .eq('id', accountId)
        .single(),
      loadVendorKeywords(supabase),
    ])
    const account = accountResult.data

    // ─── Lock check ────────────────────────────────────────────
    const lockExpiry = account?.scan_locked_until ? new Date(account.scan_locked_until) : null
    if (lockExpiry && lockExpiry > new Date()) {
      return NextResponse.json({
        processed: 0, bills_found: 0,
        scan_progress: account?.scan_progress || 0,
        max_emails: isDailyScan ? MAX_EMAILS_DAILY : MAX_EMAILS_MANUAL,
        complete: false, locked: true,
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
          scan_cursor: null, scan_progress: 0, scan_locked_until: null,
        })
        .eq('id', accountId)

      sendPushToUser(userId, {
        title: 'Scan voltooid',
        body: `${currentProgress} e-mails gescand.`,
        tag: 'paywatch-scan-complete', url: '/betalingen',
      }).catch(() => {})

      return NextResponse.json({
        processed: 0, bills_found: 0, remaining: 0,
        scan_progress: currentProgress, max_emails: maxEmails, complete: true,
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
      sinceDate = ''
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
          scan_cursor: null, scan_progress: 0, scan_locked_until: null,
        })
        .eq('id', accountId)

      sendPushToUser(userId, {
        title: 'Scan voltooid',
        body: `${currentProgress} e-mails gescand. Geen nieuwe e-mails.`,
        tag: 'paywatch-scan-complete', url: '/betalingen',
      }).catch(() => {})

      return NextResponse.json({
        processed: 0, bills_found: 0, remaining: 0,
        scan_progress: currentProgress, max_emails: maxEmails, complete: true,
      })
    }

    // ─── Process batch ─────────────────────────────────────────
    let billsFound = 0
    let processed = 0
    let skippedByKeyword = 0

    for (const msg of messages) {
      processed++

      // Dedup
      const { data: existing } = await supabase
        .from('scan_processed')
        .select('gmail_message_id')
        .eq('user_id', userId)
        .eq('gmail_message_id', msg.id)
        .maybeSingle()

      if (existing) continue

      const unified = toUnifiedEmail(msg)
      const bodySnippet = (unified.bodyText || unified.bodyHtml || '').slice(0, 500)

      // ─── Keyword pre-filter (free, instant) ──────────────────
      // Skip emails that clearly aren't bills — saves AI cost + time
      if (!mightBeBill(unified.subject, unified.fromEmail, bodySnippet, vendorKeywords)) {
        skippedByKeyword++
        await supabase.from('scan_processed').insert({
          user_id: userId, gmail_message_id: msg.id, provider: 'outlook',
        })
        continue
      }

      // ─── AI Classification (Gemini) ──────────────────────────
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

      console.log(`[Outlook Scan] Bill classified: "${unified.subject}" from ${unified.fromEmail}`)

      // Download PDF if present
      let pdfText: string | null = null
      if (msg.hasAttachments) {
        try {
          const attachments = await fetchAttachments(accessToken, msg.id)
          const pdf = attachments.find(
            (a: { contentType: string }) => a.contentType === 'application/pdf'
          )
          if (pdf?.contentBytes) {
            // Try to extract text from PDF using unpdf
            try {
              const { extractText } = await import('unpdf')
              const pdfBuffer = Buffer.from(pdf.contentBytes, 'base64')
              const { text: pages } = await extractText(new Uint8Array(pdfBuffer))
              const fullText = Array.isArray(pages) ? pages.join('\n') : String(pages || '')
              if (fullText && fullText.trim().length > 10) {
                pdfText = fullText.slice(0, 3000)
              }
            } catch (pdfErr) {
              console.warn('[Outlook Scan] PDF extraction failed:', pdfErr)
              // Fallback: try raw text decode for text-based PDFs
              try {
                const decoded = Buffer.from(pdf.contentBytes, 'base64').toString('utf-8')
                if (decoded && !/[\x00-\x08\x0E-\x1F]/.test(decoded.slice(0, 200))) {
                  pdfText = decoded.slice(0, 3000)
                }
              } catch { /* binary PDF, skip */ }
            }
          }
        } catch (attErr) {
          console.warn('[Outlook Scan] Attachment fetch failed:', attErr)
        }
      }

      const fullBody = unified.bodyHtml || unified.bodyText || ''

      // ─── AI Extraction (Sonnet) ──────────────────────────────
      const billData = await extractBillFromEmail(
        unified.subject,
        fullBody,
        pdfText,
        userId
      )

      if (!billData || !billData.vendor) {
        console.warn('[Outlook Scan] Extraction returned no data for:', unified.subject)
        await supabase.from('scan_processed').insert({
          user_id: userId, gmail_message_id: msg.id, provider: 'outlook',
        })
        continue
      }

      console.log(`[Outlook Scan] Extracted: ${billData.vendor} €${(billData.amount_cents / 100).toFixed(2)}`)

      // Vendor lookup + incasso detection (already done in pipeline, but double-check)
      const vendorMatch = await lookupVendor(billData.vendor)
      if (vendorMatch?.matched && vendorMatch.category) {
        billData.category_hint = vendorMatch.category
      }

      const incassoResult = await detectIncassoAgency(billData.vendor)

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

      // ─── Insert bill — FIXED: iban (not iban_encrypted) ──────
      const { error: insertError } = await supabase.from('bills').insert({
        id: generateNanoid(),
        user_id: userId,
        vendor: billData.vendor,
        amount: billData.amount_cents,
        currency: billData.currency || 'EUR',
        iban: billData.iban || null,
        reference: billData.reference,
        due_date: billData.due_date || new Date().toISOString().split('T')[0],
        received_date: billData.received_date || unified.receivedDate.split('T')[0],
        category: incassoResult.matched ? 'incasso' : (billData.category_hint || 'overig'),
        status: billData.due_date && new Date(billData.due_date) < new Date() ? 'action' : 'outstanding',
        source: 'outlook_scan',
        outlook_message_id: msg.id,
        outlook_account_id: accountId,
        hash,
        escalation_stage: billData.escalation_stage || 'factuur',
        payment_url: billData.payment_url,
        requires_review: (billData.confidence?.amount || 0) < 0.7,
        original_email_subject: unified.subject,
        original_email_from: unified.fromEmail,
      })

      if (insertError) {
        console.error('[Outlook Scan] Bill insert FAILED:', insertError.message, '| Vendor:', billData.vendor)
      } else {
        billsFound++
        console.log(`[Outlook Scan] Bill SAVED: ${billData.vendor} €${(billData.amount_cents / 100).toFixed(2)}`)
      }

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

    if (isComplete) {
      sendPushToUser(userId, {
        title: 'Scan voltooid',
        body: `${newProgress} e-mails gescand, ${billsFound} rekening${billsFound !== 1 ? 'en' : ''} gevonden.`,
        tag: 'paywatch-scan-complete', url: '/betalingen',
      }).catch(() => {})
    }

    // ─── Background self-chain ─────────────────────────────────
    if (!isComplete) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'
      fetch(`${appUrl}/api/scan/outlook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId, batchSize, isDailyScan,
          _background: true, _userId: userId,
        }),
      }).catch(() => {})
    }

    console.log(`[Outlook Scan] Batch done: ${processed} processed, ${skippedByKeyword} skipped by keyword, ${billsFound} bills saved`)

    return NextResponse.json({
      processed, bills_found: billsFound,
      remaining: isComplete ? 0 : 'more',
      scan_progress: newProgress, max_emails: maxEmails,
      complete: isComplete, hit_limit: hitLimit,
    })
  } catch (error) {
    console.error('[Outlook Scan] Error:', error)

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
    .map((b: any) => alphabet[b % alphabet.length])
    .join('')
}
