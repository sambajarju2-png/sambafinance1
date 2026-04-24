import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerSupabaseClient();

  const [financesRes, expensesRes, billsRes] = await Promise.all([
    supabase.from('user_finances').select('*').eq('user_id', userId).single(),
    supabase.from('user_expenses').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('bills').select('id, amount, status, expense_id, escalation_stage, vendor')
      .eq('user_id', userId)
      .in('status', ['outstanding', 'action']),
  ]);

  const finances = financesRes.data;
  const expenses = expensesRes.data || [];
  const bills = billsRes.data || [];

  if (!finances) {
    return NextResponse.json({
      has_finances: false, totaal_inkomen: 0, totaal_vaste_lasten: 0,
      totaal_open_rekeningen: 0, vrij_besteedbaar: 0, expenses_count: 0,
      bills_count: 0, toeslagen: null, salary_window: null,
    });
  }

  const totaal_inkomen = finances.netto_inkomen +
    (finances.partner_inkomen || 0) + (finances.duo_inkomen || 0) +
    (finances.uitkering_inkomen || 0) + (finances.toeslagen_inkomen || 0) +
    (finances.overig_inkomen || 0);

  const linkedExpenseIds = new Set(
    bills.filter((b: { expense_id: string | null }) => b.expense_id)
      .map((b: { expense_id: string }) => b.expense_id)
  );

  const totaal_vaste_lasten = expenses.reduce((sum: number, exp: { id: string; monthly_amount: number }) => {
    if (linkedExpenseIds.has(exp.id)) return sum;
    return sum + (exp.monthly_amount || 0);
  }, 0);

  const totaal_open_rekeningen = bills.reduce((sum: number, bill: { amount: number }) => sum + bill.amount, 0);
  const vrij_besteedbaar = totaal_inkomen - totaal_vaste_lasten - totaal_open_rekeningen;

  const expenses_in_incasso = (expenses as Array<{ id: string; name: string; monthly_amount: number }>)
    .filter(exp => linkedExpenseIds.has(exp.id))
    .map(exp => ({
      id: exp.id, name: exp.name, amount: exp.monthly_amount,
      bill: (bills as Array<{ id: string; expense_id: string | null; amount: number; vendor: string }>)
        .find(b => b.expense_id === exp.id),
    }));

  return NextResponse.json({
    has_finances: true, totaal_inkomen, totaal_vaste_lasten,
    totaal_open_rekeningen, vrij_besteedbaar,
    expenses_count: expenses.length, bills_count: bills.length,
    expenses_in_incasso,
    toeslagen: finances.toeslagen_eligible,
    salary_window: finances.salary_day_from && finances.salary_day_to
      ? { from: finances.salary_day_from, to: finances.salary_day_to } : null,
  });
}
