import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/email/test
 * Body: { type: 'welcome' | 'features' | 'digest' }
 * Sends a test email to the logged-in user.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { type } = await req.json();
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: 'No email' }, { status: 400, headers: NO_CACHE });

    const { data: settings } = await supabase
      .from('user_settings')
      .select('display_name, language, streak_current')
      .eq('user_id', userId)
      .single();

    const name = settings?.display_name || user.email.split('@')[0];
    const language = settings?.language || 'nl';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hypesamba.com';

    if (type === 'welcome') {
      const res = await fetch(`${baseUrl}/api/email/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name, language }),
      });
      const data = await res.json();
      return NextResponse.json({ ...data, type: 'welcome', sent_to: user.email }, { headers: NO_CACHE });
    }

    if (type === 'features') {
      const res = await fetch(`${baseUrl}/api/email/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name, language }),
      });
      const data = await res.json();
      return NextResponse.json({ ...data, type: 'features', sent_to: user.email }, { headers: NO_CACHE });
    }

    if (type === 'digest') {
      const today = new Date().toISOString().split('T')[0];
      const { data: bills } = await supabase.from('bills').select('status, due_date, amount, vendor').eq('user_id', userId);
      const allBills = bills || [];
      const outstanding = allBills.filter((b: { status: string }) => b.status !== 'settled');
      const overdue = outstanding.filter((b: { due_date: string }) => b.due_date < today);
      const totalCents = outstanding.reduce((s: number, b: { amount: number }) => s + b.amount, 0);

      // Find next due
      const upcoming = outstanding
        .filter((b: { due_date: string }) => b.due_date >= today)
        .sort((a: { due_date: string }, b: { due_date: string }) => a.due_date.localeCompare(b.due_date));

      const stats = {
        outstanding: outstanding.length,
        overdue: overdue.length,
        paid_this_week: 0,
        streak: settings?.streak_current || 0,
        total_outstanding_cents: totalCents,
        next_due_vendor: upcoming[0]?.vendor || null,
        next_due_date: upcoming[0]?.due_date || null,
      };

      const res = await fetch(`${baseUrl}/api/email/digest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name, language, stats }),
      });
      const data = await res.json();
      return NextResponse.json({ ...data, type: 'digest', sent_to: user.email }, { headers: NO_CACHE });
    }

    return NextResponse.json({ error: 'Unknown type. Use: welcome, features, digest' }, { status: 400, headers: NO_CACHE });
  } catch (err) {
    console.error('Test email error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
