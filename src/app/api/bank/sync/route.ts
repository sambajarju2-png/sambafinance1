import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/push'
import { syncUserConnections } from '@/lib/bank-sync'
import { log } from '@/lib/logger'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie')
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            if (!cookieHeader) return []
            return cookieHeader.split(';').map(c => {
              const [name, ...rest] = c.trim().split('=')
              return { name, value: rest.join('=') }
            })
          },
          setAll() {}
        }
      }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    // GDPR Art. 18: block processing for restricted accounts
    const { isAccountRestricted } = await import('@/lib/auth')
    if (await isAccountRestricted(user.id)) {
      return NextResponse.json({ error: 'Account is bevroren. Neem contact op met je organisatie.' }, { status: 403 })
    }

    // PW-10: Rate limit — 5 syncs per 5 minutes
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const allowed = await checkRateLimit(user.id, 'bank/sync', 5, 5)
    if (!allowed) {
      return NextResponse.json({ error: 'Te veel verzoeken. Probeer het over een paar minuten opnieuw.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const connectionId = body.connection_id

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const result = await syncUserConnections(supabase, user.id, { connectionId })

    if (result.connectionsFound === 0) {
      return NextResponse.json({ error: 'Geen gekoppelde bank gevonden' }, { status: 404 })
    }

    // Send push notification for new bill matches
    if (result.billMatchDetails.length > 0) {
      try {
        const first = result.billMatchDetails[0]
        const amountStr = `\u20ac${(first.amount / 100).toFixed(2).replace('.', ',')}`
        const dateStr = new Date(first.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
        const title = first.type === 'partial' ? 'Mogelijke betaling gevonden' : 'Betaling gevonden'
        const bodyText = result.billMatchDetails.length === 1
          ? `Het lijkt erop dat je ${first.vendor} van ${amountStr} hebt betaald op ${dateStr}. Klopt dit?`
          : `${result.billMatchDetails.length} betalingen gevonden die bij je rekeningen passen. Controleer op het Overzicht.`
        await sendPushToUser(user.id, { title, body: bodyText, url: '/overzicht', tag: 'paywatch-match' })
      } catch { /* notification is non-critical */ }
    }

    // Always refresh analytics synchronously before returning so the dashboard
    // shows real data immediately — not stuck on "data wordt verwerkt"
    try {
      await supabase.rpc('refresh_user_analytics', { p_user_id: user.id })
    } catch (rpcErr) {
      console.error('[Bank] Analytics refresh failed (non-fatal):', rpcErr)
    }

    // PW-09: Run categorization + subscription detection AFTER response.
    // after() keeps the function alive until this completes (Next.js 15+).
    // categorizeUserTransactions refreshes analytics again on completion.
    const userId = user.id
    after(async () => {
      try {
        const { categorizeUserTransactions } = await import('@/lib/analytics/categorizer')
        const catResult = await categorizeUserTransactions(userId)
        log.info('Categorization complete', { userId, categorized: catResult.categorized, aiCalled: catResult.aiCalled })
      } catch (catErr) {
        log.error('Categorization error (after)', { error: catErr instanceof Error ? catErr.message : 'unknown' })
      }
      try {
        await supabase.rpc('detect_recurring_payments', { p_user_id: userId })
        log.info('Subscription detection complete', { userId })
      } catch (subErr) {
        log.error('Subscription detection error (after)', { error: subErr instanceof Error ? subErr.message : 'unknown' })
      }
    })

    return NextResponse.json({ success: true, new_transactions: result.newTransactions, matched: result.matched, bill_matches: result.billMatches })
  } catch (error) {
    console.error('[Bank] Sync error:', error)
    return NextResponse.json({ error: 'Synchronisatie mislukt' }, { status: 500 })
  }
}
