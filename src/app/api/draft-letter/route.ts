import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateDraftLetter } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';

const ADMIN_EMAILS = ['sambajarju2@gmail.com', 'ayeitssamba@gmail.com', 'reiskenners@gmail.com'];

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

    // Check draft letter limit based on referrals
    const { data: settings } = await supabase
      .from('user_settings')
      .select('language, first_name, last_name, date_of_birth, draft_letter_count')
      .eq('user_id', userId)
      .single();

    // Get user email to check admin
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const isAdmin = authUser?.email && ADMIN_EMAILS.includes(authUser.email.toLowerCase());

    if (!isAdmin) {
      // Count completed referrals
      const { data: referrals } = await supabase
        .from('referrals')
        .select('id')
        .eq('referrer_id', userId)
        .eq('status', 'completed');

      const completedReferrals = referrals?.length || 0;
      const currentCount = settings?.draft_letter_count || 0;

      // Calculate limit: 2 free + 10 per friend, 3+ = unlimited
      let maxLetters: number;
      if (completedReferrals >= 3) {
        maxLetters = 999999; // Unlimited
      } else {
        maxLetters = 2 + (completedReferrals * 10);
      }

      if (currentCount >= maxLetters) {
        const needed = completedReferrals === 0 ? 1 : completedReferrals + 1;
        return NextResponse.json({
          error: 'letter_limit',
          message: `Je hebt ${currentCount} brieven gebruikt. Nodig een vriend uit voor meer.`,
          current: currentCount,
          max: maxLetters,
          referrals_needed: needed,
        }, { status: 403, headers: NO_CACHE });
      }
    }

    // Fetch bill
    guard();
    const { data: bill, error: billErr } = await supabase.from('bills').select('*').eq('id', bill_id).eq('user_id', userId).single();
    if (billErr || !bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404, headers: NO_CACHE });

    const language = settings?.language || 'nl';
    const fullName = [settings?.first_name, settings?.last_name].filter(Boolean).join(' ') || '';
    const dob = settings?.date_of_birth || '';
    let formattedDob = '';
    if (dob) { const d = new Date(dob + 'T00:00:00'); formattedDob = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; }

    guard();
    const letter = await generateDraftLetter(
      { vendor: bill.vendor, amount: bill.amount, reference: bill.reference, escalation_stage: bill.escalation_stage || 'factuur' },
      intent, details || '', language, userId, fullName, formattedDob
    );

    // Increment counter
    await supabase.from('user_settings').update({
      draft_letter_count: (settings?.draft_letter_count || 0) + 1,
    }).eq('user_id', userId);

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
