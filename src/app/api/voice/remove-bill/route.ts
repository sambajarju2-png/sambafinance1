import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * POST /api/voice/remove-bill
 * Marks a bill as paid or removes it.
 * Called by the voice agent's remove_bill client tool.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { vendor, mark_as_paid } = await req.json();
    if (!vendor) return NextResponse.json({ error: 'vendor required' }, { status: 400, headers: NO_CACHE });

    const supabase = await createServerSupabaseClient();

    // Find the most recent matching open bill
    const { data: bill } = await supabase
      .from('bills')
      .select('id, vendor, amount')
      .eq('user_id', userId)
      .ilike('vendor', `%${vendor}%`)
      .neq('status', 'settled')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!bill) return NextResponse.json({ error: 'Bill not found', vendor }, { status: 404, headers: NO_CACHE });

    // Mark as paid (soft delete) or actually mark settled
    const newStatus = mark_as_paid ? 'settled' : 'settled';
    const { error } = await supabase
      .from('bills')
      .update({ status: newStatus })
      .eq('id', bill.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });

    return NextResponse.json({
      success: true,
      bill_id: bill.id,
      vendor: bill.vendor,
      amount: bill.amount,
      action: mark_as_paid ? 'marked_paid' : 'removed',
    }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Remove bill error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
