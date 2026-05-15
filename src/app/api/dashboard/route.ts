import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/dashboard
 * Composite route — replaces 8 independent fetches on /overzicht.
 * Single auth check + all Supabase queries in Promise.all.
 * Cache: private, 20s max-age, 60s SWR — safe for financial dashboards.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  // Use service-role client for all reads (no per-query RLS overhead)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // ── All queries in parallel ────────────────────────────────────────────────
  const [
    billsRes,
    settingsRes,
    connectionsRes,
    analyticsRes,
    financesRes,
    expensesRes,
    paidThisMonthRes,
    pendingTxRes,
  ] = await Promise.all([
    // 1. Full bills list (used by page + finances calculation)
    supabase.from('bills').select('*').eq('user_id', userId).order('due_date', { ascending: true }),

    // 2. User settings (plan)
    supabase.from('user_settings').select('plan, is_restricted').eq('user_id', userId).single(),

    // 3. Bank connections (linked only)
    supabase.from('bank_connections').select('id, institution_name, status').eq('user_id', userId).eq('status', 'linked'),

    // 4. Analytics monthly totals — latest month only, for entry card
    supabase.from('analytics_monthly_totals').select('income_cents, expenses_cents, net_cents').eq('user_id', userId).order('month', { ascending: false }).limit(1),

    // 5. User finances (for vrij besteedbaar)
    supabase.from('user_finances').select('*').eq('user_id', userId).single(),

    // 6. Active expenses (for vrij besteedbaar)
    supabase.from('user_expenses').select('id, name, monthly_amount').eq('user_id', userId).eq('is_active', true),

    // 7. Bills paid this month (for vrij besteedbaar)
    supabase.from('bills').select('id, amount, expense_id').eq('user_id', userId).eq('status', 'settled').gte('paid_at', monthStart),

    // 8. Pending bank match transactions
    supabase.from('bank_transactions')
      .select('id, creditor_name, creditor_iban, amount, booking_date, remittance_info, matched_bill_id, connection_id, match_type')
      .eq('user_id', userId)
      .not('matched_bill_id', 'is', null)
      .is('match_status', null)
      .order('booking_date', { ascending: false }),
  ]);

  const bills = billsRes.data || [];
  const plan = settingsRes.data?.plan || 'gratis';
  const is_restricted = settingsRes.data?.is_restricted || false;
  const connections = connectionsRes.data || [];
  const has_bank = connections.length > 0;
  const latestMonth = analyticsRes.data?.[0] || null;
  const finances = financesRes.data;
  const expenses = expensesRes.data || [];
  const paidThisMonth = paidThisMonthRes.data || [];
  const pendingTx = pendingTxRes.data || [];

  // ── Finances computation (mirrors /api/finances/overview) ─────────────────
  let financesOverview: Record<string, unknown> | null = null;
  if (finances) {
    const linkedExpenseIds = new Set(
      bills.filter((b: { expense_id: string | null; status: string }) =>
        b.expense_id && ['outstanding', 'action'].includes(b.status)
      ).map((b: { expense_id: string }) => b.expense_id)
    );
    const paidLinkedExpenseIds = new Set(
      paidThisMonth.filter((b: { expense_id: string | null }) => b.expense_id)
        .map((b: { expense_id: string }) => b.expense_id)
    );

    const totaal_inkomen = (finances.netto_inkomen || 0) + (finances.partner_inkomen || 0) +
      (finances.duo_inkomen || 0) + (finances.uitkering_inkomen || 0) +
      (finances.toeslagen_inkomen || 0) + (finances.overig_inkomen || 0);

    const totaal_vaste_lasten = expenses.reduce((sum: number, exp: { id: string; monthly_amount: number }) => {
      if (linkedExpenseIds.has(exp.id) || paidLinkedExpenseIds.has(exp.id)) return sum;
      return sum + (exp.monthly_amount || 0);
    }, 0);

    const openBills = bills.filter((b: { status: string }) => ['outstanding', 'action'].includes(b.status));
    const totaal_open_rekeningen = openBills.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);
    const totaal_betaald_deze_maand = paidThisMonth.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);
    const vrij_besteedbaar = totaal_inkomen - totaal_vaste_lasten - totaal_open_rekeningen - totaal_betaald_deze_maand;

    const expenses_in_incasso = expenses
      .filter((exp: { id: string }) => linkedExpenseIds.has(exp.id))
      .map((exp: { id: string; name: string; monthly_amount: number }) => ({
        id: exp.id, name: exp.name, amount: exp.monthly_amount,
        bill: bills.find((b: { expense_id: string | null }) => b.expense_id === exp.id),
      }));

    financesOverview = {
      has_finances: true, totaal_inkomen, totaal_vaste_lasten,
      totaal_open_rekeningen, totaal_betaald_deze_maand, vrij_besteedbaar,
      expenses_count: expenses.length, bills_count: openBills.length,
      expenses_in_incasso,
      toeslagen: finances.toeslagen_eligible,
      salary_window: finances.salary_day_from && finances.salary_day_to
        ? { from: finances.salary_day_from, to: finances.salary_day_to } : null,
    };
  } else {
    financesOverview = {
      has_finances: false, totaal_inkomen: 0, totaal_vaste_lasten: 0,
      totaal_open_rekeningen: 0, totaal_betaald_deze_maand: 0,
      vrij_besteedbaar: 0, expenses_count: 0, bills_count: 0,
      expenses_in_incasso: [], toeslagen: null, salary_window: null,
    };
  }

  // ── Bank match assembly (join tx with already-fetched bills + connections) ─
  const billMap = new Map(bills.map((b: { id: string }) => [b.id, b]));
  const connMap = new Map(connections.map((c: { id: string; institution_name: string }) => [c.id, c]));

  const matches = pendingTx
    .filter((tx: { matched_bill_id: string }) => {
      const bill = billMap.get(tx.matched_bill_id) as { status?: string } | undefined;
      return bill && bill.status !== 'settled';
    })
    .map((tx: { id: string; matched_bill_id: string; connection_id: string; creditor_name: string; creditor_iban: string; amount: number; booking_date: string; remittance_info: string; match_type: string }) => {
      const bill = billMap.get(tx.matched_bill_id) as { vendor: string; amount: number; due_date: string } | undefined;
      const conn = connMap.get(tx.connection_id) as { institution_name?: string } | undefined;
      return {
        transaction_id: tx.id,
        bill_id: tx.matched_bill_id,
        bank_name: conn?.institution_name || 'Bank',
        creditor_name: tx.creditor_name,
        creditor_iban: tx.creditor_iban,
        tx_amount: tx.amount,
        tx_date: tx.booking_date,
        tx_description: tx.remittance_info,
        bill_vendor: bill?.vendor || '',
        bill_amount: bill?.amount || 0,
        bill_due_date: bill?.due_date || '',
        match_type: (tx.match_type || 'exact') as 'exact' | 'partial',
      };
    });

  return NextResponse.json(
    {
      bills,
      plan,
      is_restricted,
      has_bank,
      finances: financesOverview,
      matches,
      analytics: latestMonth
        ? { income: latestMonth.income_cents, expenses: latestMonth.expenses_cents, net: latestMonth.net_cents }
        : null,
    },
    {
      headers: {
        // Private (per-user), 20s fresh, 60s stale-while-revalidate
        // SWR hook refreshes every 30s anyway, so stale data never shows for long
        'Cache-Control': 'private, max-age=20, stale-while-revalidate=60',
      },
    }
  );
}
