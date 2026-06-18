import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/email/features/cron
 * Called by cron-job.org daily. Sends the "day 2" features onboarding email
 * to users who finished onboarding ~2 days ago and haven't received it yet.
 * Auth: Authorization: Bearer CRON_SECRET
 *
 * Idempotency: user_settings.features_email_sent_at is stamped after a
 * successful send so each user receives this email at most once. The created_at
 * window (2-14 days old) anchors the "day 2" timing and avoids back-filling the
 * entire existing user base on the first run.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hypesamba.com';

    const now = Date.now();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Users who completed onboarding 2-14 days ago and haven't been sent the
    // features email yet. notify_email_features lets them opt out.
    const { data: users } = await supabase
      .from('user_settings')
      .select('user_id, display_name, language, notify_email_features, features_email_sent_at, created_at')
      .eq('onboarding_complete', true)
      .is('features_email_sent_at', null)
      .lte('created_at', twoDaysAgo)
      .gte('created_at', fourteenDaysAgo);

    let sent = 0;
    let skipped = 0;

    for (const user of (users || [])) {
      if (user.notify_email_features === false) { skipped++; continue; }

      try {
        const { data: authData } = await supabase.auth.admin.getUserById(user.user_id);
        const email = authData?.user?.email;
        if (!email) { skipped++; continue; }

        const res = await fetch(`${baseUrl}/api/email/features`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${cronSecret}` },
          body: JSON.stringify({ email, name: user.display_name || '', language: user.language || 'nl' }),
        });

        if (!res.ok) { skipped++; continue; }

        // Stamp only after a successful send so a transient failure retries tomorrow.
        await supabase
          .from('user_settings')
          .update({ features_email_sent_at: new Date().toISOString() })
          .eq('user_id', user.user_id);

        sent++;
      } catch (err) {
        console.error(`Features email error for ${user.user_id}:`, err);
        skipped++;
      }
    }

    return NextResponse.json({ ok: true, sent, skipped, total: (users || []).length });
  } catch (err) {
    console.error('Features cron error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
