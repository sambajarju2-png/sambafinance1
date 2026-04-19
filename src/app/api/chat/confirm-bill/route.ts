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
    const category = body.category || 'overig';
    const iban = body.iban || null;
    const reference = body.reference || null;
    const escalation_stage = body.escalation_stage || 'factuur';

    // Ensure due_date is a valid date string (NOT NULL in DB)
    let due_date = body.due_date || null;
    if (!due_date) {
      // Default to 7 days from now if not provided
      const d = new Date();
      d.setDate(d.getDate() + 7);
      due_date = d.toISOString().split('T')[0];
    }
    // Normalize date format: ensure YYYY-MM-DD
    if (due_date && !due_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      try {
        due_date = new Date(due_date).toISOString().split('T')[0];
      } catch {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        due_date = d.toISOString().split('T')[0];
      }
    }

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
        due_date,
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
