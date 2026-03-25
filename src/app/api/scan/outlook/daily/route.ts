/**
 * POST /api/scan/outlook/daily
 * 
 * Daily cron: scans all connected Outlook accounts for new emails.
 * Called by cron-job.org at 11:05 AM (5 min after Gmail scan).
 * 
 * File: src/app/api/scan/outlook/daily/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getValidOutlookToken } from '@/lib/outlook-tokens'
import { fetchEmails, toUnifiedEmail } from '@/lib/microsoft-graph'
import { classifyEmail, extractBillFromEmail } from '@/lib/ai/pipeline'
import { detectIncassoAgency } from '@/lib/incasso-detect'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()

    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()

    const { data: accounts, error } = await supabase
      .from('outlook_accounts')
      .select('id, user_id, email, last_scanned')
      .eq('needs_reauth', false)
      .or(`last_scanned.is.null,last_scanned.lt.${twentyHoursAgo}`)
      .limit(50)

    if (error || !accounts?.length) {
      return NextResponse.json({
        message: 'No Outlook accounts to scan',
        accounts_checked: 0,
      })
    }

    const results = []

    for (const account of accounts) {
      try {
        const tokenResult = await getValidOutlookToken(account.id, account.user_id)
        if (!tokenResult) {
          results.push({ email: account.email, status: 'needs_reauth' })
          continue
        }

        const sinceDate = account.last_scanned || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        const { messages } = await fetchEmails(tokenResult.accessToken, {
          sinceDate,
          top: 100,
        })

        let billsFound = 0
        let processed = 0

        for (const msg of messages) {
          const { data: existing } = await supabase
            .from('scan_processed')
            .select('gmail_message_id')
            .eq('user_id', account.user_id)
            .eq('gmail_message_id', msg.id)
            .eq('provider', 'outlook')
            .maybeSingle()

          if (existing) continue

          processed++
          const unified = toUnifiedEmail(msg)
          const bodySnippet = (unified.bodyText || unified.bodyHtml || '').slice(0, 500)

          // classifyEmail(subject, sender, body, userId)
          const classification = await classifyEmail(
            unified.subject,
            unified.fromEmail,
            bodySnippet,
            account.user_id
          )

          // Mark as processed regardless
          await supabase.from('scan_processed').insert({
            user_id: account.user_id,
            gmail_message_id: msg.id,
            provider: 'outlook',
          })

          if (!classification.is_bill) continue

          // extractBillFromEmail(subject, body, pdfText, userId)
          const billData = await extractBillFromEmail(
            unified.subject,
            unified.bodyHtml || unified.bodyText,
            null,
            account.user_id
          )

          if (!billData || !billData.vendor) continue

          // detectIncassoAgency(vendorName) → IncassoMatch
          const incassoResult = await detectIncassoAgency(billData.vendor)

          const raw = `${billData.vendor}|${billData.amount_cents}|${billData.due_date || ''}|${billData.reference || ''}`
          const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16)

          const { data: dupCheck } = await supabase
            .from('bills')
            .select('id')
            .eq('user_id', account.user_id)
            .eq('hash', hash)
            .maybeSingle()

          if (!dupCheck) {
            const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
            const idBytes = randomBytes(12)
            const billId = Array.from(idBytes).map((b) => alphabet[b % alphabet.length]).join('')

            await supabase.from('bills').insert({
              id: billId,
              user_id: account.user_id,
              vendor: billData.vendor,
              amount: billData.amount_cents,
              currency: billData.currency || 'EUR',
              reference: billData.reference,
              due_date: billData.due_date || new Date().toISOString().split('T')[0],
              received_date: billData.received_date || unified.receivedDate.split('T')[0],
              category: billData.category_hint || 'overig',
              status: billData.due_date && new Date(billData.due_date) < new Date() ? 'action' : 'outstanding',
              source: 'outlook_scan',
              outlook_message_id: msg.id,
              outlook_account_id: account.id,
              hash,
              payment_url: billData.payment_url,
              escalation_stage: incassoResult.matched ? incassoResult.suggested_escalation : billData.escalation_stage,
            })
            billsFound++
          }
        }

        await supabase
          .from('outlook_accounts')
          .update({ last_scanned: new Date().toISOString() })
          .eq('id', account.id)

        results.push({
          email: account.email,
          status: 'scanned',
          processed,
          bills_found: billsFound,
        })
      } catch (accountError) {
        console.error(`[Outlook Daily] Error scanning ${account.email}:`, accountError)
        results.push({ email: account.email, status: 'error' })
      }
    }

    return NextResponse.json({
      accounts_scanned: results.length,
      results,
    })
  } catch (error) {
    console.error('[Outlook Daily Scan] Error:', error)
    return NextResponse.json({ error: 'Daily scan failed' }, { status: 500 })
  }
}
