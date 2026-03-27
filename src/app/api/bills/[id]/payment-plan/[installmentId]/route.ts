import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/service';

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

// PATCH — Mark an installment as paid (or undo)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; installmentId: string } }
) {
  const userId = await getAuthUserId(req);
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const DEADLINE = Date.now() + 55000;
  const guard = () => {
    if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT');
  };

  try {
    const billId = params.id;
    const installmentId = params.installmentId;
    const body = await req.json();
    const { status, paid_date } = body as {
      status: 'paid' | 'pending';
      paid_date?: string;
    };

    if (!status || !['paid', 'pending'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "paid" or "pending"' },
        { status: 400, headers: NO_CACHE }
      );
    }

    const supabase = createServiceRoleClient();
    guard();

    // Verify bill belongs to user
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('id, amount')
      .eq('id', billId)
      .eq('user_id', userId)
      .single();

    if (billError || !bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404, headers: NO_CACHE }
      );
    }

    guard();

    // Update the installment
    const updateData: Record<string, unknown> = { status };
    if (status === 'paid') {
      updateData.paid_date = paid_date || new Date().toISOString().split('T')[0];
    } else {
      updateData.paid_date = null;
    }

    const { data: installment, error: installmentError } = await supabase
      .from('plan_installments')
      .update(updateData)
      .eq('id', installmentId)
      .eq('user_id', userId)
      .select()
      .single();

    if (installmentError || !installment) {
      console.error('Failed to update installment:', installmentError);
      return NextResponse.json(
        { error: 'Installment not found' },
        { status: 404, headers: NO_CACHE }
      );
    }

    guard();

    // Check if all installments are now paid → complete the plan
    const { data: plan } = await supabase
      .from('payment_plans')
      .select('id, total_terms')
      .eq('bill_id', billId)
      .eq('user_id', userId)
      .single();

    if (plan) {
      const { count: paidCount } = await supabase
        .from('plan_installments')
        .select('id', { count: 'exact', head: true })
        .eq('plan_id', plan.id)
        .eq('status', 'paid');

      if (paidCount === plan.total_terms) {
        // All paid → mark plan as completed, bill as settled
        await supabase
          .from('payment_plans')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', plan.id);

        await supabase
          .from('bills')
          .update({
            status: 'settled',
            paid_at: new Date().toISOString(),
            paid_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', billId)
          .eq('user_id', userId);
      } else {
        // Not all paid → ensure plan is active (in case of undo)
        await supabase
          .from('payment_plans')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', plan.id);

        // Ensure bill is not settled (in case of undo)
        await supabase
          .from('bills')
          .update({
            status: 'outstanding',
            paid_at: null,
            paid_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', billId)
          .eq('user_id', userId)
          .eq('status', 'settled'); // Only revert if it was settled
      }
    }

    return NextResponse.json(installment, { headers: NO_CACHE });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504, headers: NO_CACHE }
      );
    }
    console.error('Installment update error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_CACHE }
    );
  }
}
