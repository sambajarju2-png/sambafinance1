import { createClient } from '@supabase/supabase-js';

/**
 * Aggregates bank_transactions into analytics_monthly_totals and analytics_monthly_categories.
 * Called after every bank sync + categorization.
 * Uses upsert so it's safe to call multiple times.
 */
export async function aggregateAnalytics(userId: string): Promise<{ months: number; categories: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all non-internal transactions for this user
  const { data: txs, error } = await supabase
    .from('bank_transactions')
    .select('booking_date, amount, pw_category, is_internal_transfer')
    .eq('user_id', userId)
    .or('is_internal_transfer.eq.false,is_internal_transfer.is.null')
    .not('amount', 'eq', 0);

  if (error || !txs || txs.length === 0) return { months: 0, categories: 0 };

  // ── Build monthly totals ──────────────────────────────────────────────────
  const monthTotals = new Map<string, { income: number; expenses: number; tx_count: number }>();

  for (const tx of txs) {
    if (!tx.booking_date) continue;
    const month = tx.booking_date.substring(0, 7) + '-01'; // YYYY-MM-01
    const existing = monthTotals.get(month) || { income: 0, expenses: 0, tx_count: 0 };

    if (tx.amount > 0) {
      existing.income += tx.amount;
    } else {
      existing.expenses += Math.abs(tx.amount);
    }
    existing.tx_count++;
    monthTotals.set(month, existing);
  }

  const totalsRows = Array.from(monthTotals.entries()).map(([month, t]) => ({
    user_id: userId,
    month,
    income_cents: t.income,
    expenses_cents: t.expenses,
    net_cents: t.income - t.expenses,
    debt_payments_cents: 0,
    tx_count: t.tx_count,
  }));

  // ── Build monthly category breakdown ─────────────────────────────────────
  const catKey = (month: string, category: string, direction: string) => `${month}|${category}|${direction}`;
  const catTotals = new Map<string, { total: number; count: number; sub_category: string | null }>();

  for (const tx of txs) {
    if (!tx.booking_date || !tx.pw_category) continue;
    const month = tx.booking_date.substring(0, 7) + '-01';
    const direction = tx.amount > 0 ? 'income' : 'expense';
    const key = catKey(month, tx.pw_category, direction);
    const existing = catTotals.get(key) || { total: 0, count: 0, sub_category: null };
    existing.total += Math.abs(tx.amount);
    existing.count++;
    catTotals.set(key, existing);
  }

  const catRows = Array.from(catTotals.entries()).map(([key, c]) => {
    const [month, category, direction] = key.split('|');
    return {
      user_id: userId,
      month,
      category,
      sub_category: c.sub_category,
      direction,
      total_cents: c.total,
      tx_count: c.count,
    };
  });

  // ── Upsert both tables ────────────────────────────────────────────────────
  const [totalsResult, catResult] = await Promise.all([
    totalsRows.length > 0
      ? supabase
          .from('analytics_monthly_totals')
          .upsert(totalsRows, { onConflict: 'user_id,month' })
      : Promise.resolve({ error: null }),
    catRows.length > 0
      ? supabase
          .from('analytics_monthly_categories')
          .upsert(catRows, { onConflict: 'user_id,month,category,direction' })
      : Promise.resolve({ error: null }),
  ]);

  if (totalsResult.error) {
    console.error('[Analytics] Failed to upsert monthly_totals:', totalsResult.error);
  }
  if (catResult.error) {
    console.error('[Analytics] Failed to upsert monthly_categories:', catResult.error);
  }

  return { months: totalsRows.length, categories: catRows.length };
}
