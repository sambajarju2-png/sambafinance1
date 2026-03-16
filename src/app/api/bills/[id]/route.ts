import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ============================================================
// PATCH /api/bills/[id] — Update a bill (mark paid, favorite, etc.)
// ============================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    guard();
    const billId = params.id;
    const body = await req.json();
    const supabase = await createServerSupabaseClient();

    // Fetch current bill to validate ownership and current status
    const { data: current, error: fetchError } = await supabase
      .from('bills')
      .select('id, status, user_id')
      .eq('id', billId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404, headers: NO_CACHE });
    }

    // Never overwrite settled status (system prompt rule)
    if (current.status === 'settled' && body.status && body.status !== 'settled') {
      return NextResponse.json(
        { error: 'Cannot change status of a settled bill' },
        { status: 409, headers: NO_CACHE }
      );
    }

    // Build update object — only allow specific fields
    const updates: Record<string, unknown> = {};

    // Mark as paid
    if (body.status === 'settled') {
      updates.status = 'settled';
      updates.paid_at = new Date().toISOString();
      updates.paid_date = body.paid_date || new Date().toISOString().split('T')[0];
    } else if (body.status && ['outstanding', 'action', 'review'].includes(body.status)) {
      updates.status = body.status;
    }

    // Toggle favorite
    if (typeof body.is_favorite === 'boolean') {
      updates.is_favorite = body.is_favorite;
    }

    // Update notes
    if (typeof body.notes === 'string') {
      updates.notes = body.notes;
    }

    // Update escalation stage
    if (body.escalation_stage) {
      updates.escalation_stage = body.escalation_stage;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400, headers: NO_CACHE });
    }

    guard();
    const { data: updated, error: updateError } = await supabase
      .from('bills')
      .update(updates)
      .eq('id', billId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Bill update error:', updateError);
      return NextResponse.json({ error: 'Failed to update bill' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ bill: updated }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504, headers: NO_CACHE });
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: NO_CACHE });
  }
}

// ============================================================
// DELETE /api/bills/[id] — Delete a bill
// ============================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', params.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Bill delete error:', error);
      return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ success: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: NO_CACHE });
  }
}
