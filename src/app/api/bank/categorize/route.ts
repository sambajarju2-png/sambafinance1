import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { log } from '@/lib/logger'

export const maxDuration = 60

/**
 * POST /api/bank/categorize
 * 
 * Manually trigger categorization + aggregation + subscription detection
 * for the authenticated user. Loops until all uncategorized transactions
 * are processed (500 per pass).
 */
export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie')
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () =>
            (cookieHeader || '').split(';').map(c => {
              const [name, ...rest] = c.trim().split('=')
              return { name, value: rest.join('=') }
            }),
          setAll: () => {},
        },
      }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { categorizeUserTransactions } = await import('@/lib/analytics/categorizer')

    // Loop until all uncategorized are processed (500 per pass, max 5 passes)
    let totalCategorized = 0
    let totalAI = 0
    for (let pass = 0; pass < 5; pass++) {
      const { data: remaining } = await supabase
        .from('bank_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .or('category_source.eq.unset,category_source.is.null')

      if (!remaining || (remaining as any).length === 0) break

      const result = await categorizeUserTransactions(user.id)
      totalCategorized += result.categorized
      totalAI += result.aiCalled
      log.info(`Categorize pass ${pass + 1}`, { userId: user.id, categorized: result.categorized, ai: result.aiCalled })

      if (result.categorized === 0) break
    }

    // Re-detect subscriptions (categorizeUserTransactions already refreshes analytics)
    try {
      await supabase.rpc('detect_recurring_payments', { p_user_id: user.id })
    } catch (e) {
      log.error('Subscription detection error', { error: e instanceof Error ? e.message : 'unknown' })
    }

    return NextResponse.json({ 
      ok: true, 
      categorized: totalCategorized, 
      ai_calls: totalAI 
    })
  } catch (error) {
    console.error('[Categorize] Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
