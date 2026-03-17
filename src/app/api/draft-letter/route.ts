import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateDraftLetter } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/draft-letter
 *
 * On-demand letter drafting via Haiku.
 * Cost: ~$0.002 per letter (384 max_tokens).
 *
 * Body: {
 *   bill_id: string,
 *   intent: 'betalingsregeling' | 'uitstel' | 'bezwaar' | 'bevestiging',
 *   details: string (e.g. "6 maanden" or "bedrag klopt niet")
 * }
 *
 * Returns: { letter: { subject: string, body: string } }
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
    // Rate limit: 20 letters per hour
    guard();
    const allowed = await checkRateLimit(userId, 'draft-letter', 20);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429, headers: NO_CACHE }
      );
    }

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

    // Fetch the bill
    guard();
    const supabase = await createServerSupabaseClient();
    const { data: bill, error: billErr } = await supabase
      .from('bills')
      .select('*')
      .eq('id', bill_id)
      .eq('user_id', userId)
      .single();

    if (billErr || !bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404, headers: NO_CACHE });
    }

    // Get user language
    const { data: settings } = await supabase
      .from('user_settings')
      .select('language')
      .eq('user_id', userId)
      .single();

    const language = settings?.language || 'nl';

    // Generate the letter
    guard();
    const letter = await generateDraftLetter(
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

    // Ensure we have clean string values (not nested JSON or raw responses)
    const cleanSubject = typeof letter.subject === 'string' ? letter.subject : String(letter.subject || '');
    const cleanBody = typeof letter.body === 'string' ? letter.body : String(letter.body || '');

    // Replace literal \n with actual newlines (Haiku sometimes returns escaped newlines)
    const formattedBody = cleanBody
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .trim();

    return NextResponse.json({
      letter: {
        subject: cleanSubject,
        body: formattedBody,
      },
    }, { headers: NO_CACHE });
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
