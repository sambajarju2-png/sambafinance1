import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getGrantedFeatures } from '@/lib/org-features-server';

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

    const granted = await getGrantedFeatures(createServiceRoleClient(), user.id);
    if (!granted.spending_analytics) {
      return NextResponse.json({ error: 'Uitgaven-analyse is niet beschikbaar via je organisatie' }, { status: 403 });
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
    const [categoriesRes, cashflowRes, totalsRes, debtRes, uncatRes, txRes, subsRes] = await Promise.all([
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
      // Recent transactions for Transacties tab
      supabase
        .from('bank_transactions')
        .select('id, booking_date, amount, creditor_name, debtor_name, merchant_clean_name, pw_category, pw_sub_category, category_source, category_confidence, creditor_iban, is_internal_transfer, remittance_info')
        .eq('user_id', user.id)
        .or('is_internal_transfer.eq.false,is_internal_transfer.is.null')
        .order('booking_date', { ascending: false })
        .limit(50),
      // Detected subscriptions
      supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('annual_cost', { ascending: false }),
    ]);

    // Map monthly_totals to include debt_payments_cents as expected
    const monthly_totals = (totalsRes.data || []).map(t => ({
      month: t.month,
      income_cents: t.income_cents,
      expenses_cents: t.expenses_cents,
      net_cents: t.net_cents,
      debt_payments_cents: t.debt_payments_cents || 0,
    }));

    const ADMIN_EMAILS = ['sambajarju2@gmail.com'];
    const is_admin = ADMIN_EMAILS.includes(user.email || '');

    return NextResponse.json({
      has_bank_connection,
      is_admin,
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
      transactions: (txRes.data || []).map(t => ({
        id: t.id,
        booking_date: t.booking_date,
        amount: t.amount,
        display_name: t.merchant_clean_name || t.creditor_name || t.debtor_name || t.remittance_info || 'Onbekend',
        creditor_name: t.creditor_name,
        pw_category: t.pw_category || 'onbekend',
        pw_sub_category: t.pw_sub_category,
        category_source: t.category_source,
        category_confidence: t.category_confidence,
        creditor_iban: t.creditor_iban,
      })),
      subscriptions: (subsRes.data || []).map(s => ({
        id: s.id,
        creditor_name: s.creditor_name,
        merchant_clean_name: s.merchant_clean_name,
        pw_category: s.pw_category,
        frequency: s.frequency,
        avg_amount: s.avg_amount,
        annual_cost: s.annual_cost,
        occurrences: s.occurrences,
        confidence: s.confidence,
        last_paid: s.last_paid,
        next_expected: s.next_expected,
      })),
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
