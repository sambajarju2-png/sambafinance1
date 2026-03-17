import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' };

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: 'VAPID keys not configured. Push disabled.' }, { status: 200, headers: NO_CACHE });
    }

    let webpush: typeof import('web-push');
    try { webpush = await import('web-push'); } catch {
      return NextResponse.json({ error: 'web-push not installed' }, { status: 200, headers: NO_CACHE });
    }

    webpush.setVapidDetails('mailto:info@hypesamba.com', vapidPublic, vapidPrivate);

    const supabase = createServiceRoleClient();
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const threeDays = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

    const { data: urgentBills } = await supabase
      .from('bills')
      .select('id, user_id, vendor, amount, due_date')
      .neq('status', 'settled')
      .or(`due_date.eq.${threeDays},due_date.eq.${tomorrow},due_date.lt.${today}`)
      .limit(100);

    if (!urgentBills || urgentBills.length === 0) {
      return NextResponse.json({ message: 'No urgent bills', sent: 0 }, { headers: NO_CACHE });
    }

    const userBills: Record<string, typeof urgentBills> = {};
    for (const bill of urgentBills) {
      if (!userBills[bill.user_id]) userBills[bill.user_id] = [];
      userBills[bill.user_id].push(bill);
    }

    let totalSent = 0;
    for (const [userId, bills] of Object.entries(userBills)) {
      const { data: settings } = await supabase.from('user_settings').select('notify_push_enabled').eq('user_id', userId).single();
      if (!settings?.notify_push_enabled) continue;

      const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth_key').eq('user_id', userId);
      if (!subs || subs.length === 0) continue;

      const overdue = bills.filter((b) => b.due_date < today);
      const dueTmrw = bills.filter((b) => b.due_date === tomorrow);
      const due3d = bills.filter((b) => b.due_date === threeDays);

      let title = 'PayWatch';
      let body = '';
      if (overdue.length > 0) { title = `${overdue.length} achterstallige rekening${overdue.length > 1 ? 'en' : ''}`; body = overdue.map((b) => b.vendor).join(', '); }
      else if (dueTmrw.length > 0) { title = `${dueTmrw.length} rekening${dueTmrw.length > 1 ? 'en' : ''} vervalt morgen`; body = dueTmrw.map((b) => b.vendor).join(', '); }
      else if (due3d.length > 0) { title = `${due3d.length} rekening${due3d.length > 1 ? 'en' : ''} vervalt over 3 dagen`; body = due3d.map((b) => b.vendor).join(', '); }

      const payload = JSON.stringify({ title, body, tag: 'paywatch-reminder', url: '/betalingen' });

      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload);
          totalSent++;
        } catch (err) {
          if (err instanceof Error && (err.message.includes('410') || err.message.includes('404'))) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      }
    }

    return NextResponse.json({ sent: totalSent }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Push notify error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
