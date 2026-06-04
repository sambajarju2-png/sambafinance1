import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/push'
import { verifyCronSecret } from '@/lib/verify-cron'
import { syncUserConnections } from '@/lib/bank-sync'
import { log } from '@/lib/logger'

export const maxDuration = 60

/**
 * GET /api/cron/bank-sync
 * Daily cron (06:00 UTC). For every user with a linked Enable Banking
 * connection: pulls new transactions, categorizes them, refreshes the
 * analytics aggregations and detects recurring payments. Connections whose
 * PSD2 consent has expired are flagged so the user is prompted to reconnect.
 *
 * Self-limits its runtime so it never hard-times-out mid-write; any users not
 * reached are simply picked up on the next daily run.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const startedAt = Date.now()
  const TIME_BUDGET_MS = 50_000

  const summary = {
    usersProcessed: 0,
    usersSkipped: 0,
    newTransactions: 0,
    billMatches: 0,
    expired: 0,
    errors: 0,
  }

  try {
    const { data: conns } = await supabase
      .from('bank_connections')
      .select('user_id')
      .eq('status', 'linked')
      .not('account_ids', 'is', null)

    const userIds = [...new Set((conns || []).map(c => c.user_id))]

    for (const userId of userIds) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        summary.usersSkipped = userIds.length - summary.usersProcessed
        log.info('[cron/bank-sync] time budget reached, deferring remaining users', { remaining: summary.usersSkipped })
        break
      }

      try {
        const result = await syncUserConnections(supabase, userId)
        summary.usersProcessed++
        summary.newTransactions += result.newTransactions
        summary.billMatches += result.billMatches
        summary.expired += result.expiredConnectionIds.length

        // Refresh immediately so newly-synced (still-uncategorized) transactions
        // show up, then categorize (which refreshes again) and detect subscriptions.
        try { await supabase.rpc('refresh_user_analytics', { p_user_id: userId }) } catch { /* non-fatal */ }

        try {
          const { categorizeUserTransactions } = await import('@/lib/analytics/categorizer')
          await categorizeUserTransactions(userId)
        } catch (catErr) {
          log.error('[cron/bank-sync] categorize error', { userId, error: catErr instanceof Error ? catErr.message : 'unknown' })
        }

        try { await supabase.rpc('detect_recurring_payments', { p_user_id: userId }) } catch { /* non-fatal */ }

        // Notify about detected bill payments (same UX as a manual sync).
        if (result.billMatchDetails.length > 0) {
          try {
            const first = result.billMatchDetails[0]
            const amountStr = `€${(first.amount / 100).toFixed(2).replace('.', ',')}`
            const dateStr = new Date(first.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
            const title = first.type === 'partial' ? 'Mogelijke betaling gevonden' : 'Betaling gevonden'
            const bodyText = result.billMatchDetails.length === 1
              ? `Het lijkt erop dat je ${first.vendor} van ${amountStr} hebt betaald op ${dateStr}. Klopt dit?`
              : `${result.billMatchDetails.length} betalingen gevonden die bij je rekeningen passen. Controleer op het Overzicht.`
            await sendPushToUser(userId, { title, body: bodyText, url: '/overzicht', tag: 'paywatch-match' })
          } catch { /* notification is non-critical */ }
        }
      } catch (userErr) {
        summary.errors++
        log.error('[cron/bank-sync] user sync error', { userId, error: userErr instanceof Error ? userErr.message : 'unknown' })
      }
    }

    log.info('[cron/bank-sync] done', summary)
    return NextResponse.json({ success: true, ...summary, elapsed_ms: Date.now() - startedAt })
  } catch (error) {
    log.error('[cron/bank-sync] fatal', { error: error instanceof Error ? error.message : 'unknown' })
    return NextResponse.json({ error: 'Cron failed', ...summary }, { status: 500 })
  }
}
