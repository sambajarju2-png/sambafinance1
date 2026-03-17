import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeBillHash, generateBillId } from '@/lib/bills-server';
import { BILL_CATEGORIES } from '@/lib/bills';

// ============================================================
// GET /api/bills — List all bills for the authenticated user
// ============================================================
export async function GET(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    guard();
    const supabase = await createServerSupabaseClient();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // optional filter
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    let query = supabase
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    guard();
    const { data: bills, error } = await query;

    if (error) {
      console.error('Bills fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ bills: bills || [] }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504, headers: NO_CACHE });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: NO_CACHE });
  }
}

// ============================================================
// POST /api/bills — Create a new bill (manual entry)
// ============================================================
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    guard();
    const body = await req.json();

    // Validate required fields
    const { vendor, amount_cents, due_date, category } = body;

    if (!vendor || typeof vendor !== 'string' || vendor.trim().length === 0) {
      return NextResponse.json({ error: 'Vendor is required' }, { status: 400, headers: NO_CACHE });
    }

    if (!amount_cents || typeof amount_cents !== 'number' || amount_cents <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number (in cents)' }, { status: 400, headers: NO_CACHE });
    }

    if (!due_date || typeof due_date !== 'string') {
      return NextResponse.json({ error: 'Due date is required (YYYY-MM-DD)' }, { status: 400, headers: NO_CACHE });
    }

    if (!category || typeof category !== 'string') {
      return NextResponse.json({ error: 'Category is required' }, { status: 400, headers: NO_CACHE });
    }

    // Optional fields
    const iban = body.iban?.trim() || null;
    const reference = body.reference?.trim() || null;
    const notes = body.notes?.trim() || null;
    const payment_url = body.payment_url?.trim() || null;
    const received_date = body.received_date || new Date().toISOString().split('T')[0];

    // Dedup hash
    guard();
    const hash = computeBillHash(vendor.trim(), amount_cents, reference, due_date);

    const supabase = await createServerSupabaseClient();

    // Check for existing bill with same hash
    const { data: existing } = await supabase
      .from('bills')
      .select('id')
      .eq('user_id', userId)
      .eq('hash', hash)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A bill with the same vendor, amount and reference already exists' },
        { status: 409, headers: NO_CACHE }
      );
    }

    // Insert new bill
    guard();
    const billId = generateBillId();
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = due_date < today;

    const { data: bill, error: insertError } = await supabase
      .from('bills')
      .insert({
        id: billId,
        user_id: userId,
        vendor: vendor.trim(),
        amount: amount_cents,
        currency: body.currency || 'EUR',
        iban,
        reference,
        due_date,
        received_date,
        category,
        status: isOverdue ? 'action' : 'outstanding',
        source: ['manual', 'camera_scan', 'gmail_scan'].includes(body.source) ? body.source : 'manual',
        hash,
        notes,
        payment_url,
        escalation_stage: body.escalation_stage || 'factuur',
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
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: NO_CACHE });
  }
}
