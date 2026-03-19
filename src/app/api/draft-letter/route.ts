import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateDraftLetter } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    guard();
    const allowed = await checkRateLimit(userId, 'draft-letter', 20, 3600000);
    if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: NO_CACHE });

    const body = await req.json();
    const { bill_id, intent, details } = body;

    if (!bill_id || !intent) return NextResponse.json({ error: 'bill_id and intent required' }, { status: 400, headers: NO_CACHE });

    const validIntents = ['betalingsregeling', 'uitstel', 'bezwaar', 'bevestiging'];
    if (!validIntents.includes(intent)) return NextResponse.json({ error: 'Invalid intent' }, { status: 400, headers: NO_CACHE });

    guard();
    const supabase = await createServerSupabaseClient();
    const { data: bill, error: billErr } = await supabase.from('bills').select('*').eq('id', bill_id).eq('user_id', userId).single();
    if (billErr || !bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404, headers: NO_CACHE });

    // Fetch user settings: language + profile info for the letter signature
    const { data: settings } = await supabase
      .from('user_settings')
      .select('language, first_name, last_name, date_of_birth')
      .eq('user_id', userId)
      .single();

    const language = settings?.language || 'nl';
    const fullName = [settings?.first_name, settings?.last_name].filter(Boolean).join(' ') || '';
    const dob = settings?.date_of_birth || '';

    // Format DOB as DD-MM-YYYY
    let formattedDob = '';
    if (dob) {
      const d = new Date(dob + 'T00:00:00');
      formattedDob = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    }

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
      userId,
      fullName,
      formattedDob
    );

    const cleanSubject = typeof letter.subject === 'string' ? letter.subject : String(letter.subject || '');
    const cleanBody = typeof letter.body === 'string' ? letter.body : String(letter.body || '');
    const formattedBody = cleanBody.replace(/\\n/g, '\n').replace(/\\t/g, '\t').trim();

    return NextResponse.json({ letter: { subject: cleanSubject, body: formattedBody } }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') return NextResponse.json({ error: 'Request timeout' }, { status: 504, headers: NO_CACHE });
    console.error('Draft letter error:', err);
    return NextResponse.json({ error: 'Failed to generate letter' }, { status: 500, headers: NO_CACHE });
  }
}
