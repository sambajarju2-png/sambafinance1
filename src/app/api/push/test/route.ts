import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/push/test
 * 
 * Sends a test push notification to the logged-in user.
 */
export async function POST() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: 'VAPID keys niet geconfigureerd' }, { status: 500, headers: NO_CACHE });
    }

    let webpush: typeof import('web-push');
    try { webpush = await import('web-push'); } catch {
      return NextResponse.json({ error: 'web-push niet geinstalleerd' }, { status: 500, headers: NO_CACHE });
    }

    webpush.setVapidDetails('mailto:info@paywatch.app', vapidPublic, vapidPrivate);

    const supabase = await createServerSupabaseClient();
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('user_id', userId);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ error: 'Geen push-abonnement gevonden. Schakel eerst meldingen in.' }, { status: 404, headers: NO_CACHE });
    }

    const testNotifications = [
      { title: 'Rekening vervalt morgen', body: 'KPN - € 54,99 vervalt morgen. Betaal op tijd!', tag: 'test-tomorrow' },
      { title: '2 achterstallige rekeningen', body: 'Vattenfall, Gemeente Amsterdam', tag: 'test-overdue' },
      { title: 'Goed bezig!', body: 'Je hebt een streak van 5 op-tijd betalingen. Ga zo door!', tag: 'test-streak' },
    ];

    // Pick a random test notification
    const testPayload = testNotifications[Math.floor(Math.random() * testNotifications.length)];

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({ ...testPayload, url: '/betalingen' })
        );
        sent++;
      } catch (err) {
        console.error('Test push error:', err);
      }
    }

    return NextResponse.json({ ok: true, sent, message: testPayload.title }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Push test error:', err);
    return NextResponse.json({ error: 'Test melding mislukt' }, { status: 500, headers: NO_CACHE });
  }
}
