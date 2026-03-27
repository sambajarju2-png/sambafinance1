import { createServiceRoleClient } from '@/lib/supabase/server';

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

/**
 * Send a push notification to a specific user.
 * Uses service role client to bypass RLS.
 * Returns number of notifications sent (0 if user has push disabled or no subscriptions).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  try {
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) return 0;

    let webpush: typeof import('web-push');
    try { webpush = await import('web-push'); } catch { return 0; }

    webpush.setVapidDetails('mailto:info@paywatch.app', vapidPublic, vapidPrivate);

    const supabase = createServiceRoleClient();

    // Check if user has push enabled
    const { data: settings } = await supabase
      .from('user_settings')
      .select('notify_push_enabled')
      .eq('user_id', userId)
      .single();

    if (!settings?.notify_push_enabled) return 0;

    // Get push subscriptions
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('user_id', userId);

    if (!subs || subs.length === 0) return 0;

    const payloadStr = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag || 'paywatch',
      url: payload.url || '/',
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payloadStr
        );
        sent++;
      } catch (err) {
        // Remove stale subscriptions
        if (err instanceof Error && (err.message.includes('410') || err.message.includes('404'))) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }

    return sent;
  } catch (err) {
    console.error('sendPushToUser error:', err);
    return 0;
  }
}
