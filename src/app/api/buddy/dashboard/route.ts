import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/buddy/dashboard?user_id=xxx
 * Returns read-only view of a user's critical bills (incasso/deurwaarder only).
 * Only accessible by accepted buddies.
 */
export async function GET(req: NextRequest) {
  const buddyUserId = await getAuthUserId();
  if (!buddyUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const targetUserId = req.nextUrl.searchParams.get('user_id');
  if (!targetUserId) return NextResponse.json({ error: 'user_id required' }, { status: 400, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    // Verify buddy relationship exists and is accepted
    const { data: buddyRelation } = await supabase
      .from('user_buddies')
      .select('id, share_amounts, notify_on_incasso, role')
      .eq('user_id', targetUserId)
      .eq('buddy_user_id', buddyUserId)
      .eq('status', 'accepted')
      .single();

    if (!buddyRelation) {
      return NextResponse.json({ error: 'Geen toegang — je bent geen buddy van deze gebruiker' }, { status: 403, headers: NO_CACHE });
    }

    // Get target user's display name
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('display_name, first_name, last_name')
      .eq('user_id', targetUserId)
      .single();

    const userName = userSettings?.display_name
      || [userSettings?.first_name, userSettings?.last_name].filter(Boolean).join(' ')
      || 'Onbekend';

    // Get only incasso/deurwaarder bills (the critical ones)
    const { data: bills } = await supabase
      .from('bills')
      .select('id, vendor, amount, currency, due_date, escalation_stage, category, status')
      .eq('user_id', targetUserId)
      .in('escalation_stage', ['incasso', 'deurwaarder'])
      .neq('status', 'settled')
      .order('due_date', { ascending: true });

    // Optionally hide amounts based on share_amounts setting
    const safeBills = (bills || []).map((bill) => ({
      id: bill.id,
      vendor: bill.vendor,
      amount: buddyRelation.share_amounts ? bill.amount : null,
      currency: bill.currency,
      due_date: bill.due_date,
      escalation_stage: bill.escalation_stage,
      category: bill.category,
      status: bill.status,
    }));

    // Get summary stats
    const { data: allBills } = await supabase
      .from('bills')
      .select('id, escalation_stage, status')
      .eq('user_id', targetUserId)
      .neq('status', 'settled');

    const totalOutstanding = allBills?.length || 0;
    const inIncasso = allBills?.filter((b) => b.escalation_stage === 'incasso').length || 0;
    const inDeurwaarder = allBills?.filter((b) => b.escalation_stage === 'deurwaarder').length || 0;
    const hasAlerts = inIncasso > 0 || inDeurwaarder > 0;

    return NextResponse.json({
      user_name: userName,
      role: buddyRelation.role,
      share_amounts: buddyRelation.share_amounts,
      status: hasAlerts ? 'red' : 'green',
      summary: {
        total_outstanding: totalOutstanding,
        in_incasso: inIncasso,
        in_deurwaarder: inDeurwaarder,
      },
      bills: safeBills,
    }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Buddy dashboard error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
