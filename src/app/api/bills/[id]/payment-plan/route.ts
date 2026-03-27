import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/service';

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

// POST — Create a payment plan for a bill
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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
    const body = await req.json();
    const { total_terms, payment_day, start_date } = body as {
      total_terms: number;
      payment_day: number;
      start_date: string;
    };

    // Validate inputs
    if (!total_terms || total_terms < 2 || total_terms > 48) {
      return NextResponse.json(
        { error: 'total_terms must be between 2 and 48' },
        { status: 400, headers: NO_CACHE }
      );
    }
    if (!payment_day || payment_day < 1 || payment_day > 28) {
      return NextResponse.json(
        { error: 'payment_day must be between 1 and 28' },
        { status: 400, headers: NO_CACHE }
      );
    }
    if (!start_date) {
      return NextResponse.json(
        { error: 'start_date is required' },
        { status: 400, headers: NO_CACHE }
      );
    }

    const supabase = createServiceRoleClient();
    guard();

    // Verify bill belongs to user and is outstanding
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('id, amount, status, has_payment_plan')
      .eq('id', billId)
      .eq('user_id', userId)
      .single();

    if (billError || !bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404, headers: NO_CACHE }
      );
    }

    if (bill.has_payment_plan) {
      return NextResponse.json(
        { error: 'Bill already has a payment plan' },
        { status: 409, headers: NO_CACHE }
      );
    }

    if (bill.status === 'settled') {
      return NextResponse.json(
        { error: 'Cannot create plan for settled bill' },
        { status: 409, headers: NO_CACHE }
      );
    }

    guard();

    // Calculate amount per term (integer cents, last term gets remainder)
    const amountPerTerm = Math.floor(bill.amount / total_terms);
    const lastTermAmount = bill.amount - amountPerTerm * (total_terms - 1);

    // Create the payment plan
    const { data: plan, error: planError } = await supabase
      .from('payment_plans')
      .insert({
        user_id: userId,
        bill_id: billId,
        total_terms,
        amount_per_term: amountPerTerm,
        payment_day,
        start_date,
        status: 'active',
      })
      .select()
      .single();

    if (planError) {
      console.error('Failed to create payment plan:', planError);
      return NextResponse.json(
        { error: 'Failed to create payment plan' },
        { status: 500, headers: NO_CACHE }
      );
    }

    guard();

    // Generate installments
    const installments = [];
    const startDateObj = new Date(start_date);
    for (let i = 0; i < total_terms; i++) {
      // Calculate due date: start month + i months, on payment_day
      const dueDate = new Date(
        startDateObj.getFullYear(),
        startDateObj.getMonth() + i,
        payment_day
      );

      installments.push({
        plan_id: plan.id,
        user_id: userId,
        term_number: i + 1,
        due_date: dueDate.toISOString().split('T')[0],
        amount: i === total_terms - 1 ? lastTermAmount : amountPerTerm,
        status: 'pending',
      });
    }

    const { error: installmentError } = await supabase
      .from('plan_installments')
      .insert(installments);

    if (installmentError) {
      console.error('Failed to create installments:', installmentError);
      // Rollback plan
      await supabase.from('payment_plans').delete().eq('id', plan.id);
      return NextResponse.json(
        { error: 'Failed to create installments' },
        { status: 500, headers: NO_CACHE }
      );
    }

    guard();

    // Mark bill as having a payment plan
    await supabase
      .from('bills')
      .update({ has_payment_plan: true, updated_at: new Date().toISOString() })
      .eq('id', billId)
      .eq('user_id', userId);

    // Fetch complete plan with installments
    const { data: completePlan } = await supabase
      .from('payment_plans')
      .select('*, plan_installments(*)')
      .eq('id', plan.id)
      .single();

    return NextResponse.json(completePlan, { headers: NO_CACHE });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504, headers: NO_CACHE }
      );
    }
    console.error('Payment plan creation error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_CACHE }
    );
  }
}

// GET — Fetch payment plan + installments for a bill
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getAuthUserId(req);
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const billId = params.id;
    const supabase = createServiceRoleClient();

    // Verify bill belongs to user
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('id')
      .eq('id', billId)
      .eq('user_id', userId)
      .single();

    if (billError || !bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404, headers: NO_CACHE }
      );
    }

    // Fetch plan with installments ordered by term_number
    const { data: plan, error: planError } = await supabase
      .from('payment_plans')
      .select('*, plan_installments(*)')
      .eq('bill_id', billId)
      .eq('user_id', userId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(null, { headers: NO_CACHE });
    }

    // Sort installments by term_number
    if (plan.plan_installments) {
      plan.plan_installments.sort(
        (a: { term_number: number }, b: { term_number: number }) =>
          a.term_number - b.term_number
      );
    }

    // Calculate summary
    const installments = plan.plan_installments || [];
    const paidCount = installments.filter(
      (i: { status: string }) => i.status === 'paid'
    ).length;
    const paidAmount = installments
      .filter((i: { status: string }) => i.status === 'paid')
      .reduce((sum: number, i: { amount: number }) => sum + i.amount, 0);

    return NextResponse.json(
      {
        ...plan,
        summary: {
          paid_count: paidCount,
          total_count: installments.length,
          paid_amount: paidAmount,
          remaining_amount: plan.amount_per_term * plan.total_terms - paidAmount,
        },
      },
      { headers: NO_CACHE }
    );
  } catch (err: unknown) {
    console.error('Payment plan fetch error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_CACHE }
    );
  }
}

// DELETE — Cancel a payment plan
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getAuthUserId(req);
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const billId = params.id;
    const supabase = createServiceRoleClient();

    // Verify bill belongs to user
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('id')
      .eq('id', billId)
      .eq('user_id', userId)
      .single();

    if (billError || !bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404, headers: NO_CACHE }
      );
    }

    // Delete plan (cascades to installments via ON DELETE CASCADE)
    const { error: deleteError } = await supabase
      .from('payment_plans')
      .delete()
      .eq('bill_id', billId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Failed to delete payment plan:', deleteError);
      return NextResponse.json(
        { error: 'Failed to cancel payment plan' },
        { status: 500, headers: NO_CACHE }
      );
    }

    // Remove flag from bill
    await supabase
      .from('bills')
      .update({ has_payment_plan: false, updated_at: new Date().toISOString() })
      .eq('id', billId)
      .eq('user_id', userId);

    return NextResponse.json({ success: true }, { headers: NO_CACHE });
  } catch (err: unknown) {
    console.error('Payment plan cancel error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_CACHE }
    );
  }
}
