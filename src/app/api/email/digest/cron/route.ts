import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/email/digest/cron
 * Called by cron-job.org weekly (Sunday evening).
 * Sends digest email to all users with notify_email_digest = true.
 * Auth: Authorization: Bearer CRON_SECRET
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
    const today = new Date().toISOString().split('T')[0];

    // Get all users with digest enabled
    const { data: users } = await supabase
      .from('user_settings')
      .select('user_id, display_name, language, notify_email_digest, streak_current')
      .eq('onboarding_complete', true);

    let sent = 0;
    let skipped = 0;

    for (const user of (users || [])) {
      if (user.notify_email_digest === false) { skipped++; continue; }

      try {
        // Get user email
        const { data: authData } = await supabase.auth.admin.getUserById(user.user_id);
        const email = authData?.user?.email;
        if (!email) { skipped++; continue; }

        // Get bill stats
        const { data: bills } = await supabase.from('bills').select('status, due_date, amount, vendor').eq('user_id', user.user_id);
        const allBills = bills || [];
        const outstanding = allBills.filter((b: { status: string }) => b.status !== 'settled');
        const overdue = outstanding.filter((b: { due_date: string }) => b.due_date < today);
        const totalCents = outstanding.reduce((s: number, b: { amount: number }) => s + b.amount, 0);
        const upcoming = outstanding.filter((b: { due_date: string }) => b.due_date >= today).sort((a: { due_date: string }, b: { due_date: string }) => a.due_date.localeCompare(b.due_date));

        const stats = {
          outstanding: outstanding.length,
          overdue: overdue.length,
          paid_this_week: 0,
          streak: user.streak_current || 0,
          total_outstanding_cents: totalCents,
          next_due_vendor: upcoming[0]?.vendor || null,
          next_due_date: upcoming[0]?.due_date || null,
        };

        // Send digest
        await fetch(`${baseUrl}/api/email/digest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: user.display_name || '', language: user.language || 'nl', stats }),
        });
        sent++;
      } catch (err) {
        console.error(`Digest error for ${user.user_id}:`, err);
        skipped++;
      }
    }

    return NextResponse.json({ ok: true, sent, skipped, total: (users || []).length });
  } catch (err) {
    console.error('Digest cron error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
