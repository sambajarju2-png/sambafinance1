import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendApnsPush, isApnsConfigured } from '@/lib/apns';

/**
 * POST /api/push/test
 * 
 * Sends a test push notification to the logged-in user.
 * Tries BOTH web push (VAPID) and native APNs.
 */
export async function POST() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const testNotifications = [
      { title: 'Rekening vervalt morgen', body: 'KPN - € 54,99 vervalt morgen. Betaal op tijd!', tag: 'test-tomorrow' },
      { title: '2 achterstallige rekeningen', body: 'Vattenfall, Gemeente Amsterdam', tag: 'test-overdue' },
      { title: 'Goed bezig!', body: 'Je hebt een streak van 5 op-tijd betalingen. Ga zo door!', tag: 'test-streak' },
    ];
    const testPayload = testNotifications[Math.floor(Math.random() * testNotifications.length)];

    const supabase = await createServerSupabaseClient();
    let webSent = 0;
    let nativeSent = 0;
    const errors: string[] = [];

    // ── Web Push (VAPID) ──
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    if (vapidPublic && vapidPrivate) {
      try {
        const webpush = await import('web-push');
        webpush.setVapidDetails('mailto:info@paywatch.app', vapidPublic, vapidPrivate);

        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint, p256dh, auth_key')
          .eq('user_id', userId);

        for (const sub of (subs || [])) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
              JSON.stringify({ ...testPayload, url: '/betalingen' })
            );
            webSent++;
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            // Auto-clean expired subscriptions
            if (errMsg.includes('410') || errMsg.includes('404')) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
            errors.push(`Web: ${errMsg.slice(0, 80)}`);
          }
        }
      } catch (err) {
        errors.push('web-push module not available');
      }
    }

    // ── Native APNs (iOS) ──
    if (isApnsConfigured()) {
      const { data: nativeTokens } = await supabase
        .from('native_push_tokens')
        .select('token, platform')
        .eq('user_id', userId)
        .eq('platform', 'ios');

      for (const nt of (nativeTokens || [])) {
        // Use sandbox for development builds, production for App Store
        const useSandbox = process.env.APNS_SANDBOX === 'true';
        const ok = await sendApnsPush(nt.token, {
          title: testPayload.title,
          body: testPayload.body,
          url: '/betalingen',
        }, useSandbox);
        if (ok) {
          nativeSent++;
        } else {
          // Don't auto-delete token on failure — might be sandbox/production mismatch
          errors.push('APNs: send failed (check sandbox vs production mode)');
        }
      }
    } else {
      errors.push('APNs not configured (missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_KEY_P8)');
    }

    if (webSent === 0 && nativeSent === 0) {
      return NextResponse.json({
        error: 'Geen actieve push-abonnementen gevonden.',
        details: errors,
        hint: 'Open de app opnieuw om je push-abonnement te vernieuwen, of stel APNs in voor native iOS push.',
      }, { status: 404, headers: NO_CACHE });
    }

    return NextResponse.json({
      ok: true,
      web_sent: webSent,
      native_sent: nativeSent,
      message: testPayload.title,
      errors: errors.length > 0 ? errors : undefined,
    }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Push test error:', err);
    return NextResponse.json({ error: 'Test melding mislukt' }, { status: 500, headers: NO_CACHE });
  }
}
