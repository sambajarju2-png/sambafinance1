import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeBillHash, generateBillId, smartDedup } from '@/lib/bills-server';
import { BILL_CATEGORIES } from '@/lib/bills';

/**
 * GET /api/bills — List all bills
 * POST /api/bills — Create a new bill (with smart dedup)
 */
export async function GET(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    guard();
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    let query = supabase
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
      .limit(limit);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500, headers: NO_CACHE });

    return NextResponse.json({ bills: data || [] }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504, headers: NO_CACHE });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    guard();
    const body = await req.json();

    const vendor = String(body.vendor || '').trim();
    const amount_cents = Number(body.amount_cents) || 0;
    const due_date = body.due_date || null;
    const category = body.category || 'overig';
    const iban = body.iban || null;
    const reference = body.reference || null;
    const notes = body.notes || null;
    const payment_url = body.payment_url || null;
    const escalation_stage = body.escalation_stage || 'factuur';
    const source = body.source || 'manual';

    if (!vendor || !amount_cents || !due_date) {
      return NextResponse.json({ error: 'vendor, amount_cents, and due_date are required' }, { status: 400, headers: NO_CACHE });
    }

    const hash = computeBillHash(vendor, amount_cents, reference || '', due_date);
    const supabase = await createServerSupabaseClient();

    // Smart dedup — works for manual, photo scan, and Gmail
    guard();
    const dedup = await smartDedup(supabase, userId, vendor, amount_cents, reference, hash);

    if (dedup.action === 'duplicate') {
      return NextResponse.json({ message: 'Bill already exists', bill_id: dedup.existingId, duplicate: true }, { status: 200, headers: NO_CACHE });
    }

    if (dedup.action === 'updated') {
      return NextResponse.json({ message: 'Existing bill updated with new amount', bill_id: dedup.existingId, updated: true }, { status: 200, headers: NO_CACHE });
    }

    // Insert new bill
    const billId = generateBillId();
    const today = new Date().toISOString().split('T')[0];

    const { data: bill, error: insertError } = await supabase
      .from('bills')
      .insert({
        id: billId,
        user_id: userId,
        vendor,
        amount: amount_cents,
        currency: body.currency || 'EUR',
        iban,
        reference,
        due_date,
        received_date: today,
        category,
        status: due_date < today ? 'action' : 'outstanding',
        source,
        hash,
        notes,
        payment_url,
        escalation_stage,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Bill insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create bill' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ bill }, { status: 201, headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504, headers: NO_CACHE });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_CACHE });
  }
}
