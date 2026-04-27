import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/push'
import { verifyCronSecret } from '@/lib/verify-cron'
import { log } from '@/lib/logger'

/**
 * GET /api/cron/spending-alerts
 * Weekly cron (Tuesday 19:00 CET = 17:00 UTC)
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const dayOfMonth = new Date().getDate()
  const currentMonth = new Date().toISOString().slice(0, 7) // "2026-04"
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  let alertsSent = 0

  try {
    // Get users with bank connections + push enabled
    const { data: users } = await supabase
      .from('bank_connections')
      .select('user_id')
      .eq('status', 'linked')

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, alerts_sent: 0 })
    }

    const uniqueUserIds = [...new Set(users.map(u => u.user_id))]

    for (const userId of uniqueUserIds) {
      try {
        // Anti-fatigue: max 3 spending alerts per week per user
        const { count: recentAlerts } = await supabase
          .from('notification_log')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('type', ['spending_high', 'debt_positive', 'category_spike'])
          .gte('sent_at', weekAgo)

        if ((recentAlerts || 0) >= 3) continue

        // Get current month totals
        const { data: totals } = await supabase
          .from('analytics_monthly_totals')
          .select('income_cents, expenses_cents, debt_payments_cents')
          .eq('user_id', userId)
          .eq('month', `${currentMonth}-01`)
          .single()

        if (!totals || totals.income_cents === 0) continue

        const spendingRatio = totals.expenses_cents / Math.max(totals.income_cents, 1)
        const debtRatio = totals.debt_payments_cents / Math.max(totals.expenses_cents, 1)

        // Alert 1: Spending > 80% of income before day 20
        if (spendingRatio > 0.8 && dayOfMonth <= 20) {
          const pct = Math.round(spendingRatio * 100)
          const remaining = totals.income_cents - totals.expenses_cents
          const remainingStr = `€${Math.abs(remaining / 100).toFixed(0).replace('.', ',')}`

          await sendPushToUser(userId, {
            title: 'Uitgaven check',
            body: remaining > 0
              ? `Je hebt ${pct}% van je inkomen besteed. Je hebt nog ${remainingStr} over deze maand.`
              : `Je uitgaven zijn hoger dan je inkomen deze maand. Even checken kan helpen.`,
            url: '/analytics',
            tag: 'spending-alert',
          })

          await supabase.from('notification_log').insert({
            user_id: userId,
            type: 'spending_high',
          })

          alertsSent++
          continue // max 1 alert per user per run
        }

        // Alert 2: Positive debt reinforcement (> 30% of expenses go to debt)
        if (debtRatio > 0.3 && totals.debt_payments_cents > 10000) { // > €100
          const debtStr = `€${(totals.debt_payments_cents / 100).toFixed(0).replace('.', ',')}`

          await sendPushToUser(userId, {
            title: 'Goed bezig met aflossen',
            body: `Je hebt deze maand ${debtStr} afgelost aan schulden. Elke stap telt.`,
            url: '/analytics',
            tag: 'spending-alert',
          })

          await supabase.from('notification_log').insert({
            user_id: userId,
            type: 'debt_positive',
          })

          alertsSent++
          continue
        }

        // Alert 3: Category spike (check top spending categories)
        const { data: currentCats } = await supabase
          .from('analytics_monthly_categories')
          .select('category, total_cents')
          .eq('user_id', userId)
          .eq('month', `${currentMonth}-01`)
          .eq('direction', 'out')
          .order('total_cents', { ascending: false })
          .limit(5)

        if (currentCats && currentCats.length > 0) {
          // Get 3-month averages
          const { data: historicalCats } = await supabase
            .from('analytics_monthly_categories')
            .select('category, total_cents, month')
            .eq('user_id', userId)
            .eq('direction', 'out')
            .neq('month', `${currentMonth}-01`)
            .order('month', { ascending: false })
            .limit(50) // enough for 3 months × ~15 categories

          if (historicalCats && historicalCats.length > 0) {
            // Compute averages per category
            const catAvg: Record<string, { sum: number; count: number }> = {}
            for (const h of historicalCats) {
              if (!catAvg[h.category]) catAvg[h.category] = { sum: 0, count: 0 }
              catAvg[h.category].sum += h.total_cents
              catAvg[h.category].count++
            }

            for (const cc of currentCats) {
              const avg = catAvg[cc.category]
              if (!avg || avg.count === 0) continue
              const monthlyAvg = avg.sum / avg.count
              if (monthlyAvg < 5000) continue // skip if avg < €50

              if (cc.total_cents > monthlyAvg * 1.4) {
                const catLabel = cc.category // getCategoryLabel isn't available server-side easily
                const currentStr = `€${(cc.total_cents / 100).toFixed(0)}`
                const avgStr = `€${Math.round(monthlyAvg / 100)}`

                await sendPushToUser(userId, {
                  title: 'Uitgaven hoger dan normaal',
                  body: `Je hebt ${currentStr} uitgegeven aan ${catLabel} (gemiddeld ${avgStr}). Wil je je uitgaven bekijken?`,
                  url: '/analytics',
                  tag: 'spending-alert',
                })

                await supabase.from('notification_log').insert({
                  user_id: userId,
                  type: 'category_spike',
                })

                alertsSent++
                break // max 1 category alert
              }
            }
          }
        }
      } catch (userErr) {
        console.error(`[SpendingAlerts] Error for user ${userId}:`, userErr)
      }
    }

    return NextResponse.json({ success: true, alerts_sent: alertsSent })
  } catch (error) {
    console.error('[SpendingAlerts] Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export const maxDuration = 300
