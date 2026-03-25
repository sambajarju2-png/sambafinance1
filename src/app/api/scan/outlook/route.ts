/**
 * POST /api/scan/outlook
 * 
 * Fetches emails from Outlook/Hotmail via Microsoft Graph API,
 * classifies with Gemini, extracts with Haiku.
 * Uses the SAME AI pipeline as Gmail.
 * 
 * File: src/app/api/scan/outlook/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAuthUserId } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'
import { getValidOutlookToken } from '@/lib/outlook-tokens'
import {
  fetchEmails,
  fetchAttachments,
  toUnifiedEmail,
} from '@/lib/microsoft-graph'
import { classifyEmail, extractBillFromEmail } from '@/lib/ai/pipeline'
import { lookupVendor } from '@/lib/vendor-lookup'
import { detectIncassoAgency } from '@/lib/incasso-detect'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ScanRequest {
  accountId: string
  batchSize?: number
  isInitialScan?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const body: ScanRequest = await request.json()
    const { accountId, batchSize = 15, isInitialScan = false } = body

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

    // Get account scan state
    const { data: account } = await supabase
      .from('outlook_accounts')
      .select('scan_cursor, scan_progress, full_scan_complete, last_scanned')
      .eq('id', accountId)
      .single()

    // Determine date filter
    let sinceDate: string | undefined
    if (!isInitialScan && account?.last_scanned) {
      sinceDate = account.last_scanned
    } else if (isInitialScan) {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      sinceDate = sixMonthsAgo.toISOString()
    }

    // Fetch emails from Microsoft Graph
    const { messages, nextLink } = await fetchEmails(accessToken, {
      sinceDate,
      top: batchSize,
      nextLink: account?.scan_cursor || undefined,
    })

    if (!messages.length) {
      await supabase
        .from('outlook_accounts')
        .update({
          last_scanned: new Date().toISOString(),
          full_scan_complete: true,
          scan_cursor: null,
        })
        .eq('id', accountId)

      return NextResponse.json({
        processed: 0,
        bills_found: 0,
        remaining: 0,
        complete: true,
      })
    }

    // Process batch through AI pipeline
    let billsFound = 0
    let processed = 0

    for (const msg of messages) {
      processed++

      // Check if already processed (dedup)
      const { data: existing } = await supabase
        .from('scan_processed')
        .select('gmail_message_id')
        .eq('user_id', userId)
        .eq('gmail_message_id', msg.id)
        .eq('provider', 'outlook')
        .maybeSingle()

      if (existing) continue

      const unified = toUnifiedEmail(msg)

      // Step 1: Classify with Gemini
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

      // Step 2: Get PDF attachment text if present
      let pdfText: string | null = null
      if (msg.hasAttachments) {
        const attachments = await fetchAttachments(accessToken, msg.id)
        const pdfAttachment = attachments.find(
          (a) => a.contentType === 'application/pdf'
        )
        if (pdfAttachment) {
          // Pass base64 PDF content as text for extraction
          pdfText = Buffer.from(pdfAttachment.contentBytes, 'base64').toString('utf-8')
        }
      }

      // Step 3: Extract bill data with Haiku
      // extractBillFromEmail already calls lookupVendor internally
      const billData = await extractBillFromEmail(
        unified.subject,
        unified.bodyHtml || unified.bodyText,
        pdfText,
        userId
      )

      if (!billData || !billData.vendor) {
        await supabase.from('scan_processed').insert({
          user_id: userId,
          gmail_message_id: msg.id,
          provider: 'outlook',
        })
        continue
      }

      // Step 4: Incasso register check
      const incassoResult = await detectIncassoAgency(billData.vendor)

      // Step 5: Dedup check (hash-based)
      const raw = `${billData.vendor}|${billData.amount_cents}|${billData.due_date || ''}|${billData.reference || ''}`
      const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16)

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

      // Step 6: Insert the bill
      const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
      const idBytes = randomBytes(12)
      const billId = Array.from(idBytes).map((b) => alphabet[b % alphabet.length]).join('')

      const { error: insertError } = await supabase.from('bills').insert({
        id: billId,
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
        bill_subtype: incassoResult.matched ? 'incasso' : undefined,
      })

      if (!insertError) {
        billsFound++
      }

      await supabase.from('scan_processed').insert({
        user_id: userId,
        gmail_message_id: msg.id,
        provider: 'outlook',
      })
    }

    // Update scan progress
    const newProgress = (account?.scan_progress || 0) + processed
    await supabase
      .from('outlook_accounts')
      .update({
        scan_progress: newProgress,
        scan_cursor: nextLink || null,
        last_scanned: new Date().toISOString(),
        full_scan_complete: !nextLink,
      })
      .eq('id', accountId)

    return NextResponse.json({
      processed,
      bills_found: billsFound,
      remaining: nextLink ? 'more' : 0,
      scan_progress: newProgress,
      complete: !nextLink,
    })
  } catch (error) {
    console.error('[Outlook Scan] Error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het scannen' },
      { status: 500 }
    )
  }
}
