import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeToMonthly } from '@/lib/toeslagen';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const supabase = await createServerSupabaseClient();

  // Build update object — only include provided fields
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.category !== undefined) update.category = body.category;
  if (body.amount !== undefined) {
    update.amount = body.amount;
    update.monthly_amount = normalizeToMonthly(body.amount, body.interval || 'monthly');
  }
  if (body.interval !== undefined) {
    update.interval = body.interval;
    if (body.amount !== undefined || update.amount) {
      update.monthly_amount = normalizeToMonthly(
        (body.amount ?? update.amount) as number,
        body.interval
      );
    }
  }
  if (body.payment_day !== undefined) update.payment_day = body.payment_day || null;
  if (body.iban !== undefined) update.iban = body.iban || null;
  if (body.reference !== undefined) update.reference = body.reference || null;
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.last_paid_at !== undefined) update.last_paid_at = body.last_paid_at;
  if (body.last_paid_month !== undefined) update.last_paid_month = body.last_paid_month;

  const { data, error } = await supabase
    .from('user_expenses')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('[expenses] Update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('user_expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('[expenses] Delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
