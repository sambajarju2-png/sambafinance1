import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie');
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            if (!cookieHeader) return [];
            return cookieHeader.split(';').map(c => {
              const [name, ...rest] = c.trim().split('=');
              return { name, value: rest.join('=') };
            });
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check bank connection
    const { count } = await supabase
      .from('bank_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'linked');

    const has_bank_connection = (count || 0) > 0;

    // Fetch all analytics data in parallel
    const [categoriesRes, cashflowRes, totalsRes, debtRes, uncatRes] = await Promise.all([
      supabase
        .from('analytics_monthly_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('month', { ascending: false }),
      supabase
        .from('analytics_weekly_cashflow')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: true })
        .limit(12),
      supabase
        .from('analytics_monthly_totals')
        .select('*')
        .eq('user_id', user.id)
        .order('month', { ascending: true }),
      supabase
        .from('bills')
        .select('id, vendor, amount, category, status, due_date, escalation_stage')
        .eq('user_id', user.id)
        .neq('status', 'settled'),
      supabase
        .from('bank_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('pw_category', null),
    ]);

    // Map monthly_totals to include debt_payments_cents as expected
    const monthly_totals = (totalsRes.data || []).map(t => ({
      month: t.month,
      income_cents: t.income_cents,
      expenses_cents: t.expenses_cents,
      net_cents: t.net_cents,
      debt_payments_cents: t.debt_payments_cents || 0,
    }));

    return NextResponse.json({
      has_bank_connection,
      monthly_categories: categoriesRes.data || [],
      weekly_cashflow: cashflowRes.data || [],
      monthly_totals,
      debt_summary: (debtRes.data || []).map(b => ({
        id: b.id,
        vendor: b.vendor,
        amount: b.amount,
        category: b.category,
        status: b.status,
        due_date: b.due_date,
        escalation_stage: b.escalation_stage,
      })),
      uncategorized_count: uncatRes.count || 0,
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
