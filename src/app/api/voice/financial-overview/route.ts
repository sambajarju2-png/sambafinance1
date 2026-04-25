import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/bills';
import { calculateToeslagen, estimateJaarinkomen } from '@/lib/toeslagen';
import { calculateBeslagvrijeVoet } from '@/lib/beslagvrije-voet';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/voice/financial-overview
 * Returns EVERYTHING PayBuddy needs in one fast call:
 * income, expenses, toeslagen, beslagvrije voet, bills summary
 * 
 * All queries run in parallel via Promise.all for speed.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    // All queries in parallel — no waterfall
    const [financesRes, expensesRes, billsRes, settingsRes] = await Promise.all([
      supabase.from('user_finances').select('*').eq('user_id', userId).single(),
      supabase.from('user_expenses').select('name, category, monthly_amount').eq('user_id', userId).eq('is_active', true),
      supabase.from('bills').select('vendor, amount, escalation_stage, due_date, status').eq('user_id', userId).order('due_date', { ascending: true }),
      supabase.from('user_settings').select('gemeente, first_name').eq('user_id', userId).single(),
    ]);

    const finances = financesRes.data;
    const expenses = expensesRes.data || [];
    const allBills = billsRes.data || [];
    const settings = settingsRes.data;

    const openBills = allBills.filter(b => b.status !== 'settled');
    const totalOpen = openBills.reduce((sum, b) => sum + (b.amount || 0), 0);
    const escalated = openBills.filter(b => ['incasso', 'deurwaarder'].includes(b.escalation_stage || ''));
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.monthly_amount || 0), 0);

    // Due soon (next 3 days)
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 86400000);
    const dueSoon = openBills.filter(b => {
      if (!b.due_date) return false;
      const d = new Date(b.due_date);
      return d >= now && d <= threeDays;
    });

    // Income calculation
    const totalIncome = finances
      ? (finances.netto_inkomen || 0) + (finances.partner_inkomen || 0) +
        (finances.duo_inkomen || 0) + (finances.uitkering_inkomen || 0) +
        (finances.toeslagen_inkomen || 0) + (finances.overig_inkomen || 0)
      : 0;

    const vrijBesteedbaar = totalIncome - totalExpenses - totalOpen;

    // Toeslagen estimate
    let toeslag = null;
    if (finances && finances.netto_inkomen) {
      try {
        const jaarinkomen = estimateJaarinkomen(finances.netto_inkomen);
        const partnerJaar = finances.partner_inkomen ? estimateJaarinkomen(finances.partner_inkomen) : 0;
        toeslag = calculateToeslagen({
          jaarinkomen,
          has_partner: finances.has_partner || false,
          partner_jaarinkomen: partnerJaar,
          vermogen: finances.vermogen || 0,
          monthly_rent: finances.monthly_rent || 0,
          num_children: finances.num_children || 0,
          children_ages: finances.children_ages || [],
          has_kinderopvang: finances.has_kinderopvang || false,
        });
      } catch {}
    }

    // Beslagvrije voet
    let bvv = null;
    if (finances) {
      try {
        const huishoudType = finances.num_children && finances.num_children > 0 && !finances.has_partner
          ? 'alleenstaand_ouder'
          : finances.has_partner ? 'samenwonend' : 'alleenstaand';
        const zorgpremie = expenses.find(e => e.category === 'zorgverzekering')?.monthly_amount || 17500;
        const totaalToeslagen = toeslag
          ? (toeslag.zorgtoeslag.geschat_bedrag || 0) + (toeslag.huurtoeslag.geschat_bedrag || 0) + (toeslag.kindgebonden_budget.geschat_bedrag || 0)
          : 0;
        bvv = calculateBeslagvrijeVoet({
          huishoudType,
          huurCents: finances.monthly_rent || 0,
          zorgpremieCents: zorgpremie,
          toeslagenCents: totaalToeslagen,
          nettoloonCents: finances.netto_inkomen || 0,
        });
      } catch {}
    }

    // Build a natural language summary for the voice agent
    const parts: string[] = [];

    if (settings?.first_name) parts.push(`Naam: ${settings.first_name}.`);
    if (finances) {
      parts.push(`Maandinkomen: ${formatCents(totalIncome)}.`);
      parts.push(`Vaste lasten: ${formatCents(totalExpenses)}.`);
      parts.push(`Vrij besteedbaar: ${formatCents(Math.max(0, vrijBesteedbaar))}.`);
      if (finances.salary_day_from) parts.push(`Salaris komt binnen rond dag ${finances.salary_day_from}${finances.salary_day_to ? `-${finances.salary_day_to}` : ''} van de maand.`);
      if (finances.has_partner) parts.push('Heeft een partner.');
      if (finances.num_children) parts.push(`${finances.num_children} kind${finances.num_children > 1 ? 'eren' : ''}.`);
    } else {
      parts.push('Financiele gegevens zijn nog niet ingevuld.');
    }

    parts.push(`${openBills.length} openstaande rekeningen voor ${formatCents(totalOpen)} totaal.`);
    if (escalated.length > 0) parts.push(`${escalated.length} in escalatie (incasso/deurwaarder).`);
    if (dueSoon.length > 0) parts.push(`${dueSoon.length} rekeningen vervallen binnen 3 dagen.`);

    if (toeslag) {
      const totaalToeslag = (toeslag.zorgtoeslag.geschat_bedrag || 0) + (toeslag.huurtoeslag.geschat_bedrag || 0) + (toeslag.kindgebonden_budget.geschat_bedrag || 0);
      if (totaalToeslag > 0) parts.push(`Geschatte toeslagen: ${formatCents(totaalToeslag)} per maand.`);
    }

    if (bvv) {
      parts.push(`Beslagvrije voet: ${formatCents(bvv.beslagvrijeVoet)}.`);
    }

    if (settings?.gemeente) parts.push(`Woont in ${settings.gemeente}.`);

    return NextResponse.json({
      name: settings?.first_name || null,
      gemeente: settings?.gemeente || null,
      // Income
      has_finances: !!finances,
      total_income: formatCents(totalIncome),
      total_income_cents: totalIncome,
      salary_window: finances ? { from: finances.salary_day_from, to: finances.salary_day_to } : null,
      has_partner: finances?.has_partner || false,
      num_children: finances?.num_children || 0,
      // Expenses
      total_expenses: formatCents(totalExpenses),
      total_expenses_cents: totalExpenses,
      expenses: expenses.map(e => ({ name: e.name, category: e.category, amount: formatCents(e.monthly_amount || 0) })),
      // Disposable
      vrij_besteedbaar: formatCents(Math.max(0, vrijBesteedbaar)),
      vrij_besteedbaar_cents: Math.max(0, vrijBesteedbaar),
      // Bills
      open_bills: openBills.length,
      total_open: formatCents(totalOpen),
      escalated_count: escalated.length,
      due_soon: dueSoon.map(b => ({ vendor: b.vendor, amount: formatCents(b.amount || 0), due_date: b.due_date })),
      bills_top10: openBills.slice(0, 10).map(b => ({ vendor: b.vendor, amount: formatCents(b.amount || 0), stage: b.escalation_stage || 'factuur', due_date: b.due_date })),
      // Toeslagen
      toeslagen: toeslag ? {
        zorgtoeslag: formatCents(toeslag.zorgtoeslag.geschat_bedrag || 0),
        huurtoeslag: formatCents(toeslag.huurtoeslag.geschat_bedrag || 0),
        kindgebonden_budget: formatCents(toeslag.kindgebonden_budget.geschat_bedrag || 0),
        totaal: formatCents((toeslag.zorgtoeslag.geschat_bedrag || 0) + (toeslag.huurtoeslag.geschat_bedrag || 0) + (toeslag.kindgebonden_budget.geschat_bedrag || 0)),
      } : null,
      // Beslagvrije voet
      beslagvrije_voet: bvv ? formatCents(bvv.beslagvrijeVoet) : null,
      // Natural language summary for the agent
      summary: parts.join(' '),
    }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Voice financial overview error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
