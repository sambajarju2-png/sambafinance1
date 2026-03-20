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

    webpush.setVapidDetails('mailto:info@paywatch.app', vapidPublic, vapidPrivate);

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

    interface UrgentBill { id: string; user_id: string; vendor: string; amount: number; due_date: string; }

    const userBills: Record<string, UrgentBill[]> = {};
    for (const bill of urgentBills) {
      if (!userBills[bill.user_id]) userBills[bill.user_id] = [];
      userBills[bill.user_id].push(bill as UrgentBill);
    }

    let totalSent = 0;
    for (const [userId, bills] of Object.entries(userBills)) {
      const { data: settings } = await supabase.from('user_settings').select('notify_push_enabled').eq('user_id', userId).single();
      if (!settings?.notify_push_enabled) continue;

      const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth_key').eq('user_id', userId);
      if (!subs || subs.length === 0) continue;

      const overdue = bills.filter((b: UrgentBill) => b.due_date < today);
      const dueTmrw = bills.filter((b: UrgentBill) => b.due_date === tomorrow);
      const due3d = bills.filter((b: UrgentBill) => b.due_date === threeDays);

      let title = 'PayWatch';
      let body = '';
      if (overdue.length > 0) { title = `${overdue.length} achterstallige rekening${overdue.length > 1 ? 'en' : ''}`; body = overdue.map((b: UrgentBill) => b.vendor).join(', '); }
      else if (dueTmrw.length > 0) { title = `${dueTmrw.length} rekening${dueTmrw.length > 1 ? 'en' : ''} vervalt morgen`; body = dueTmrw.map((b: UrgentBill) => b.vendor).join(', '); }
      else if (due3d.length > 0) { title = `${due3d.length} rekening${due3d.length > 1 ? 'en' : ''} vervalt over 3 dagen`; body = due3d.map((b: UrgentBill) => b.vendor).join(', '); }

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

    // === BUDGET ALERTS (max 1 per week per user) ===
    let budgetAlertsSent = 0;
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hypesamba.com';

    const { data: budgetUsers } = await supabase
      .from('user_settings')
      .select('user_id, monthly_budget_cents, last_budget_alert_at, notify_push_enabled, notify_email_digest, display_name, language')
      .gt('monthly_budget_cents', 0);

    for (const bu of (budgetUsers || [])) {
      // Skip if alert sent within last week
      if (bu.last_budget_alert_at && bu.last_budget_alert_at > oneWeekAgo) continue;

      // Get total outstanding
      const { data: outBills } = await supabase
        .from('bills')
        .select('amount')
        .eq('user_id', bu.user_id)
        .neq('status', 'settled');

      const totalOutstanding = (outBills || []).reduce((s: number, b: { amount: number }) => s + b.amount, 0);
      if (totalOutstanding <= bu.monthly_budget_cents) continue;

      // Over budget! Send push if enabled
      if (bu.notify_push_enabled) {
        const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth_key').eq('user_id', bu.user_id);
        const budgetEur = (bu.monthly_budget_cents / 100).toFixed(2);
        const totalEur = (totalOutstanding / 100).toFixed(2);
        const payload = JSON.stringify({
          title: 'Budget overschreden',
          body: `Je openstaande rekeningen (€${totalEur}) zijn hoger dan je budget (€${budgetEur}).`,
          tag: 'paywatch-budget',
          url: '/instellingen?tab=budget',
        });

        for (const sub of (subs || [])) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload);
            budgetAlertsSent++;
          } catch (err) {
            if (err instanceof Error && (err.message.includes('410') || err.message.includes('404'))) {
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            }
          }
        }
      }

      // Send budget alert email (fire and forget)
      if (bu.notify_email_digest !== false) {
        try {
          const { data: authData } = await supabase.auth.admin.getUserById(bu.user_id);
          if (authData?.user?.email) {
            fetch(`${baseUrl}/api/email/digest`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: authData.user.email,
                name: bu.display_name || '',
                language: bu.language || 'nl',
                stats: {
                  outstanding: (outBills || []).length,
                  overdue: 0,
                  total_outstanding_cents: totalOutstanding,
                  budget_exceeded: true,
                  budget_cents: bu.monthly_budget_cents,
                },
              }),
            }).catch(() => {});
          }
        } catch {}
      }

      // Mark alert sent
      await supabase.from('user_settings').update({ last_budget_alert_at: new Date().toISOString() }).eq('user_id', bu.user_id);
    }

    return NextResponse.json({ sent: totalSent, budget_alerts: budgetAlertsSent }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Push notify error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
