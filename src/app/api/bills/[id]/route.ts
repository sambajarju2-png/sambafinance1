import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { recalculateStreak } from '@/lib/streak';
import { checkAndUnlockAchievements } from '@/lib/achievements';

/**
 * PATCH /api/bills/[id] — Edit any bill field (vendor, amount, stage, category, etc.)
 * DELETE /api/bills/[id] — Delete a bill
 */
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    guard();
    const billId = context.params.id;
    const body = await req.json();
    const supabase = await createServerSupabaseClient();

    const { data: current, error: fetchError } = await supabase
      .from('bills')
      .select('id, status, user_id')
      .eq('id', billId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404, headers: NO_CACHE });
    }

    // Never overwrite settled status with something else
    if (current.status === 'settled' && body.status && body.status !== 'settled') {
      return NextResponse.json({ error: 'Cannot change status of settled bill' }, { status: 409, headers: NO_CACHE });
    }

    const updates: Record<string, unknown> = {};

    // Status change
    if (body.status === 'settled') {
      updates.status = 'settled';
      updates.paid_at = new Date().toISOString();
      updates.paid_date = body.paid_date || new Date().toISOString().split('T')[0];
    } else if (body.status && ['outstanding', 'action', 'review'].includes(body.status)) {
      updates.status = body.status;
    }

    // Editable fields — user can change any of these
    if (typeof body.vendor === 'string' && body.vendor.trim()) updates.vendor = body.vendor.trim();
    if (typeof body.amount_cents === 'number' && body.amount_cents > 0) updates.amount = body.amount_cents;
    if (body.due_date) updates.due_date = body.due_date;
    if (body.category) updates.category = body.category;
    if (body.escalation_stage) updates.escalation_stage = body.escalation_stage;
    if (typeof body.iban === 'string') updates.iban = body.iban || null;
    if (typeof body.reference === 'string') updates.reference = body.reference || null;
    if (typeof body.notes === 'string') updates.notes = body.notes;
    if (typeof body.is_favorite === 'boolean') updates.is_favorite = body.is_favorite;
    if (typeof body.payment_url === 'string') updates.payment_url = body.payment_url || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400, headers: NO_CACHE });
    }

    updates.updated_at = new Date().toISOString();

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
      return NextResponse.json({ error: 'Failed to update' }, { status: 500, headers: NO_CACHE });
    }

    // Post-payment: recalculate streak + achievements
    if (body.status === 'settled') {
      try {
        await recalculateStreak(userId);
        await checkAndUnlockAchievements(userId);
      } catch (err) {
        console.error('Post-payment error:', err);
      }
    }

    return NextResponse.json({ bill: updated }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Timeout' }, { status: 504, headers: NO_CACHE });
    }
    console.error('Bill PATCH error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500, headers: NO_CACHE });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const billId = context.params.id;
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('bills').delete().eq('id', billId).eq('user_id', userId);
    if (error) return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500, headers: NO_CACHE });
  }
}
