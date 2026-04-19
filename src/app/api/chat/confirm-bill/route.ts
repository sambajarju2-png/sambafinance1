import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeBillHash, generateBillId, smartDedup } from '@/lib/bills-server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * POST /api/chat/confirm-bill
 * Called when user taps "Bevestig" in the chat confirmation card.
 * Inserts the bill into the bills table.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();

    const vendor = String(body.vendor || '').trim();
    const amount_cents = Number(body.amount_cents) || 0;
    const due_date = body.due_date || null;
    const category = body.category || 'overig';
    const iban = body.iban || null;
    const reference = body.reference || null;
    const escalation_stage = body.escalation_stage || 'factuur';

    if (!vendor || !amount_cents) {
      return NextResponse.json({ error: 'vendor and amount_cents required' }, { status: 400, headers: NO_CACHE });
    }

    const supabase = await createServerSupabaseClient();
    const hash = computeBillHash(vendor, amount_cents, reference || '', due_date || '');

    // Smart dedup
    const dedup = await smartDedup(supabase, userId, vendor, amount_cents, reference, hash);
    if (dedup.action === 'duplicate') {
      return NextResponse.json({ success: true, message: 'Bill already exists', bill_id: dedup.existingId, duplicate: true }, { headers: NO_CACHE });
    }

    // Insert
    const billId = generateBillId();
    const today = new Date().toISOString().split('T')[0];

    const { data: bill, error } = await supabase
      .from('bills')
      .insert({
        id: billId,
        user_id: userId,
        vendor,
        amount: amount_cents,
        currency: 'EUR',
        iban,
        reference,
        due_date: due_date || null,
        received_date: today,
        category,
        status: due_date && due_date < today ? 'action' : 'outstanding',
        source: 'chat_buddy',
        hash,
        escalation_stage,
      })
      .select()
      .single();

    if (error) {
      console.error('Chat bill insert error:', error);
      return NextResponse.json({ error: 'Failed to add bill' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ success: true, bill_id: bill.id, vendor, amount_cents }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Confirm bill error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
