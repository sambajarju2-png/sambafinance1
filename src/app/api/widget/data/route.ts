import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/widget/data
 *
 * Returns the widget payload for the authenticated user.
 * Accepts Supabase JWT via:
 *   - Authorization: Bearer <token>
 *   - Or regular cookie-based auth
 *
 * Used by the iOS BGAppRefreshTask to keep widget data fresh
 * when the app is closed.
 */
export async function GET(req: NextRequest) {
  try {
    // Get auth token from header or cookies
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    // Verify token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = user.id;
    const today = new Date().toISOString().split('T')[0];

    // Fetch bills, analytics, subscriptions in parallel
    const [billsRes, analyticsRes, subsRes, financesRes] = await Promise.all([
      supabase
        .from('bills')
        .select('id, vendor, amount, due_date, status, escalation_stage')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })
        .limit(50),
      supabase
        .from('analytics_monthly_totals')
        .select('income_cents, expenses_cents, net_cents')
        .eq('user_id', userId)
        .order('month', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('user_subscriptions')
        .select('merchant_clean_name, avg_amount')
        .eq('user_id', userId)
        .limit(50),
      supabase
        .from('user_finances')
        .select('netto_inkomen')
        .eq('user_id', userId)
        .single(),
    ]);

    const bills = billsRes.data || [];
    const analytics = analyticsRes.data;
    const subs = subsRes.data || [];
    const finances = financesRes.data;

    // Compute widget payload (same logic as widget-bridge.ts)
    const outstanding = bills.filter((b: any) => b.status !== 'settled');
    const overdue = outstanding.filter((b: any) => b.due_date < today);
    const upcoming = outstanding.filter((b: any) => b.due_date >= today);
    const settled = bills.filter((b: any) => b.status === 'settled');

    const sortedUpcoming = [...upcoming].sort(
      (a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );

    const daysUntil = (dateStr: string): number => {
      const due = new Date(dateStr + 'T00:00:00');
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      return Math.max(0, Math.ceil((due.getTime() - todayDate.getTime()) / 86400000));
    };

    const nextBillRaw = sortedUpcoming[0];
    const outstandingAmount = outstanding.reduce((s: number, b: any) => s + b.amount, 0);
    const settledAmount = settled.reduce((s: number, b: any) => s + b.amount, 0);
    const subscriptionTotal = subs.reduce((s: number, sub: any) => s + (sub.avg_amount || 0), 0);

    const income = analytics?.income_cents ?? finances?.netto_inkomen ?? 0;
    const expenses = analytics?.expenses_cents ?? 0;
    const net = analytics?.net_cents ?? income - expenses;
    const disposable = Math.max(0, income - expenses - subscriptionTotal);

    const monthlyDisposable = income - expenses;
    const debtFreeMonths =
      monthlyDisposable > 0 && outstandingAmount > 0
        ? Math.ceil(outstandingAmount / monthlyDisposable)
        : null;

    const payload = {
      updated_at: new Date().toISOString(),
      outstanding_amount: outstandingAmount,
      overdue_count: overdue.length,
      upcoming_count: upcoming.length,
      paid_amount: settledAmount,
      bank_income: income,
      bank_expenses: expenses,
      net: net,
      disposable: disposable,
      next_bill: nextBillRaw
        ? {
            id: nextBillRaw.id,
            vendor: nextBillRaw.vendor,
            amount: nextBillRaw.amount,
            due_date: nextBillRaw.due_date,
            days_until: daysUntil(nextBillRaw.due_date),
            stage: nextBillRaw.escalation_stage || 'factuur',
          }
        : null,
      upcoming_bills: sortedUpcoming.slice(0, 5).map((b: any) => ({
        id: b.id,
        vendor: b.vendor,
        amount: b.amount,
        due_date: b.due_date,
        stage: b.escalation_stage || 'factuur',
      })),
      subscription_total_monthly: subscriptionTotal,
      debt_free_months: debtFreeMonths,
    };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[widget/data] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
