import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/bills';
import { calculateToeslagen, estimateJaarinkomen } from '@/lib/toeslagen';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/voice/financial-overview
 * Lean financial overview for PayBuddy — 5 key data points:
 * 1. Monthly income breakdown
 * 2. Disposable income
 * 3. Toeslagen eligibility
 * 4. Open bills + escalation count
 * 5. Municipality
 *
 * All queries run in parallel. Use get_bill_summary for detailed bill lists.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    const [financesRes, expensesRes, billsRes, settingsRes] = await Promise.all([
      supabase.from('user_finances').select('netto_inkomen, partner_inkomen, duo_inkomen, uitkering_inkomen, toeslagen_inkomen, overig_inkomen, has_partner, num_children, children_ages, monthly_rent, has_kinderopvang, vermogen').eq('user_id', userId).single(),
      supabase.from('user_expenses').select('monthly_amount').eq('user_id', userId).eq('is_active', true),
      supabase.from('bills').select('amount, escalation_stage, status').eq('user_id', userId),
      supabase.from('user_settings').select('gemeente, first_name').eq('user_id', userId).single(),
    ]);

    const finances = financesRes.data;
    const expenses = expensesRes.data || [];
    const allBills = billsRes.data || [];
    const settings = settingsRes.data;

    // Bills summary
    const openBills = allBills.filter((b: { status: string }) => b.status !== 'settled');
    const totalOpen = openBills.reduce((sum: number, b: { amount: number }) => sum + (b.amount || 0), 0);
    const escalated = openBills.filter((b: { escalation_stage: string | null }) => ['incasso', 'deurwaarder'].includes(b.escalation_stage || ''));

    // Income
    const totalIncome = finances
      ? (finances.netto_inkomen || 0) + (finances.partner_inkomen || 0) +
        (finances.duo_inkomen || 0) + (finances.uitkering_inkomen || 0) +
        (finances.toeslagen_inkomen || 0) + (finances.overig_inkomen || 0)
      : 0;

    // Expenses
    const totalExpenses = expenses.reduce((sum: number, e: { monthly_amount: number }) => sum + (e.monthly_amount || 0), 0);

    // Disposable
    const vrijBesteedbaar = totalIncome - totalExpenses;

    // Toeslagen
    let toeslagenSummary = 'Financiele gegevens niet ingevuld, kan toeslagen niet berekenen.';
    if (finances && finances.netto_inkomen) {
      try {
        const jaarinkomen = estimateJaarinkomen(finances.netto_inkomen);
        const partnerJaar = finances.partner_inkomen ? estimateJaarinkomen(finances.partner_inkomen) : 0;
        const toeslag = calculateToeslagen({
          jaarinkomen,
          has_partner: finances.has_partner || false,
          partner_jaarinkomen: partnerJaar,
          vermogen: finances.vermogen || 0,
          monthly_rent: finances.monthly_rent || 0,
          num_children: finances.num_children || 0,
          children_ages: finances.children_ages || [],
          has_kinderopvang: finances.has_kinderopvang || false,
        });

        const zorg = toeslag.zorgtoeslag.geschat_bedrag || 0;
        const huur = toeslag.huurtoeslag.geschat_bedrag || 0;
        const kgb = toeslag.kindgebonden_budget.geschat_bedrag || 0;

        const parts: string[] = [];
        if (zorg > 0) parts.push('zorgtoeslag ' + formatCents(zorg));
        if (huur > 0) parts.push('huurtoeslag ' + formatCents(huur));
        if (kgb > 0) parts.push('kindgebonden budget ' + formatCents(kgb));
        const totaal = zorg + huur + kgb;
        toeslagenSummary = parts.length > 0
          ? 'Geschatte toeslagen: ' + parts.join(', ') + '. Totaal ' + formatCents(totaal) + ' per maand.'
          : 'Waarschijnlijk geen recht op toeslagen op basis van huidig inkomen.';
      } catch {
        toeslagenSummary = 'Kon toeslagen niet berekenen.';
      }
    }

    // Build natural language summary
    const lines: string[] = [];
    if (settings?.first_name) lines.push('Naam: ' + settings.first_name + '.');
    if (settings?.gemeente) lines.push('Woont in ' + settings.gemeente + '.');

    if (finances) {
      let inkomenDetail = 'netto ' + formatCents(finances.netto_inkomen || 0);
      if (finances.partner_inkomen) inkomenDetail += ', partner ' + formatCents(finances.partner_inkomen);
      if (finances.uitkering_inkomen) inkomenDetail += ', uitkering ' + formatCents(finances.uitkering_inkomen);
      if (finances.duo_inkomen) inkomenDetail += ', DUO ' + formatCents(finances.duo_inkomen);
      lines.push('Maandinkomen: ' + formatCents(totalIncome) + ' (' + inkomenDetail + ').');
      lines.push('Vaste lasten: ' + formatCents(totalExpenses) + '.');
      lines.push('Vrij besteedbaar: ' + formatCents(Math.max(0, vrijBesteedbaar)) + '.');
    } else {
      lines.push('Financiele gegevens zijn nog niet ingevuld.');
    }

    lines.push(openBills.length + ' openstaande rekeningen voor ' + formatCents(totalOpen) + '.');
    if (escalated.length > 0) lines.push(escalated.length + ' in escalatie (incasso of deurwaarder).');
    lines.push(toeslagenSummary);

    return NextResponse.json({ summary: lines.join(' ') }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Voice financial overview error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
