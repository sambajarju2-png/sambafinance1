import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/bills';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/voice/bill-summary
 * Returns a summary of the user's bills for the voice agent.
 * Called by the get_bill_summary client tool.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    const { data: bills } = await supabase
      .from('bills')
      .select('vendor, amount, escalation_stage, due_date, status')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    const open = (bills || []).filter(b => b.status !== 'settled');
    const settled = (bills || []).filter(b => b.status === 'settled');
    const totalOpen = open.reduce((sum, b) => sum + (b.amount || 0), 0);
    const escalated = open.filter(b => ['incasso', 'deurwaarder'].includes(b.escalation_stage || ''));

    // Find bills due in next 3 days
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 86400000);
    const dueSoon = open.filter(b => {
      if (!b.due_date) return false;
      const d = new Date(b.due_date);
      return d >= now && d <= threeDays;
    });

    return NextResponse.json({
      total_open: open.length,
      total_amount: formatCents(totalOpen),
      total_amount_cents: totalOpen,
      escalated_count: escalated.length,
      settled_count: settled.length,
      due_soon: dueSoon.map(b => ({
        vendor: b.vendor,
        amount: formatCents(b.amount || 0),
        due_date: b.due_date,
        stage: b.escalation_stage || 'factuur',
      })),
      bills: open.slice(0, 10).map(b => ({
        vendor: b.vendor,
        amount: formatCents(b.amount || 0),
        stage: b.escalation_stage || 'factuur',
        due_date: b.due_date || 'onbekend',
      })),
      summary: `${open.length} openstaande rekeningen voor ${formatCents(totalOpen)} totaal. ${escalated.length} in escalatie.${dueSoon.length > 0 ? ` ${dueSoon.length} vervallen binnenkort.` : ''}`,
    }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Bill summary error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
