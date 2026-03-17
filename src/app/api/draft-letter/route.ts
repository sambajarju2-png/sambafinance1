import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateDraftLetter } from '@/lib/ai';

/**
 * POST /api/draft-letter
 *
 * On-demand letter drafting via Haiku.
 * Only generated when user explicitly requests — zero waste.
 * Cost: ~$0.002 per letter (384 max_tokens).
 *
 * Body: { bill_id, intent, details }
 */
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => {
    if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT');
  };

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    guard();
    const body = await req.json();
    const { bill_id, intent, details } = body;

    if (!bill_id || !intent) {
      return NextResponse.json(
        { error: 'bill_id and intent are required' },
        { status: 400, headers: NO_CACHE }
      );
    }

    const validIntents = ['betalingsregeling', 'uitstel', 'bezwaar', 'bevestiging'];
    if (!validIntents.includes(intent)) {
      return NextResponse.json(
        { error: 'Invalid intent' },
        { status: 400, headers: NO_CACHE }
      );
    }

    const supabase = await createServerSupabaseClient();

    guard();
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('vendor, amount, reference, escalation_stage')
      .eq('id', bill_id)
      .eq('user_id', userId)
      .single();

    if (billError || !bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404, headers: NO_CACHE });
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('language')
      .eq('user_id', userId)
      .single();

    const language = settings?.language || 'nl';

    guard();
    const result = await generateDraftLetter(
      {
        vendor: bill.vendor,
        amount: bill.amount,
        reference: bill.reference,
        escalation_stage: bill.escalation_stage || 'factuur',
      },
      intent,
      details || '',
      language,
      userId
    );

    return NextResponse.json(result, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504, headers: NO_CACHE });
    }
    console.error('Draft letter error:', err);
    return NextResponse.json(
      { error: 'Failed to generate letter' },
      { status: 500, headers: NO_CACHE }
    );
  }
}
