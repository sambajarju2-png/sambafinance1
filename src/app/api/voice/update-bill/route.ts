import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * POST /api/voice/update-bill
 * Updates an existing bill's escalation stage, amount, or status.
 * Called by the voice agent's update_bill client tool.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { vendor, escalation_stage, amount, status } = await req.json();
    if (!vendor) return NextResponse.json({ error: 'vendor required' }, { status: 400, headers: NO_CACHE });

    const supabase = await createServerSupabaseClient();

    // Find the most recent matching open bill
    const { data: bill } = await supabase
      .from('bills')
      .select('id, vendor, amount, escalation_stage')
      .eq('user_id', userId)
      .ilike('vendor', `%${vendor}%`)
      .neq('status', 'settled')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!bill) return NextResponse.json({ error: 'Bill not found', vendor }, { status: 404, headers: NO_CACHE });

    // Build update object
    const updates: Record<string, unknown> = {};
    if (escalation_stage) updates.escalation_stage = escalation_stage;
    if (status) updates.status = status;
    if (amount) {
      const amountNum = parseFloat(String(amount).replace(',', '.'));
      updates.amount = Math.round(amountNum * 100);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400, headers: NO_CACHE });
    }

    const { error } = await supabase
      .from('bills')
      .update(updates)
      .eq('id', bill.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });

    return NextResponse.json({ success: true, bill_id: bill.id, vendor: bill.vendor, updates }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Update bill error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
