import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getGrantedFeatures } from '@/lib/org-features-server'

/**
 * GET /api/cron/payday
 * Called daily by cron. Checks if today falls within any user's salary window
 * (salary_day_from → salary_day_to) and sends a push notification:
 * "Heb je je vaste lasten betaald?"
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().getDate() // day of month (1-31)
  let notified = 0

  try {
    // Find users whose salary day is today
    // salary_day_from = first possible day, salary_day_to = last possible day
    // We notify on salary_day_from (the first day they might get paid)
    const { data: users } = await supabase
      .from('user_finances')
      .select('user_id, salary_day_from, salary_day_to')
      .eq('salary_day_from', today)

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No payday users today', notified: 0 })
    }

    for (const user of users) {
      // Get user's outstanding vaste lasten count
      const { count: openBills } = await supabase
        .from('bills')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.user_id)
        .eq('status', 'outstanding')

      // Get push subscriptions for this user
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', user.user_id)

      if (!subs || subs.length === 0) continue

      // Also insert a notification in the notifications table
      await supabase
        .from('notifications')
        .insert({
          user_id: user.user_id,
          type: 'payday_checkin',
          title: 'Salaris dag!',
          body: openBills && openBills > 0
            ? `Je hebt ${openBills} openstaande rekening${openBills !== 1 ? 'en' : ''}. Heb je je vaste lasten betaald?`
            : 'Goed bezig! Geen openstaande rekeningen.',
          data: { open_bills: openBills || 0 },
        })

      // Send web push notification (gated by the org push_notifications entitlement)
      const granted = await getGrantedFeatures(supabase, user.user_id)
      for (const sub of (granted.push_notifications ? subs : [])) {
        try {
          const webpush = await import('web-push')
          webpush.setVapidDetails(
            'mailto:samba@paywatch.nl',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
          )
          await webpush.sendNotification(
            sub.subscription,
            JSON.stringify({
              title: 'Salaris dag! 💰',
              body: openBills && openBills > 0
                ? `Je hebt ${openBills} openstaande rekening${openBills !== 1 ? 'en' : ''}. Heb je je vaste lasten betaald?`
                : 'Goed bezig! Geen openstaande rekeningen.',
              url: '/betalingen',
              tag: 'payday-checkin',
            })
          )
          notified++
        } catch (pushErr) {
          console.error(`[Payday] Push failed for user ${user.user_id}:`, pushErr)
        }
      }
    }

    return NextResponse.json({ message: `Payday check-in sent`, notified })
  } catch (error) {
    console.error('[Payday] Cron error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
