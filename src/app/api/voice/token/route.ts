import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/bills';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/voice/token
 * Generates a signed URL for ElevenLabs voice conversation.
 * Includes user context as conversation overrides.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json({ error: 'Voice not configured' }, { status: 500, headers: NO_CACHE });
  }

  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    // Load user context
    const [settingsRes, billsRes, plansRes] = await Promise.all([
      supabase.from('user_settings').select('first_name, gemeente, language, onboarding_profile').eq('user_id', userId).single(),
      supabase.from('bills').select('vendor, amount, due_date, status, escalation_stage, category').eq('user_id', userId).order('due_date', { ascending: true }).limit(30),
      supabase.from('payment_plans').select('vendor, total_amount, paid_amount, status').eq('user_id', userId).eq('status', 'active'),
    ]);

    const settings = settingsRes.data;
    const bills = billsRes.data || [];
    const plans = plansRes.data || [];
    const lang = settings?.language || 'nl';
    const firstName = settings?.first_name || '';

    const outstanding = bills.filter(b => b.status !== 'settled');
    const totalOutstanding = outstanding.reduce((sum, b) => sum + (b.amount || 0), 0);
    const escalated = outstanding.filter(b => ['herinnering', 'aanmaning', 'incasso', 'deurwaarder'].includes(b.escalation_stage || ''));

    // Build context for voice agent
    const context = `
GEBRUIKER: ${firstName || 'onbekend'}
TAAL: ${lang === 'nl' ? 'Nederlands' : 'English'}
REKENINGEN: ${outstanding.length} openstaand (${formatCents(totalOutstanding)} totaal)
ESCALATIE: ${escalated.length} in escalatie
${outstanding.slice(0, 5).map(b => `- ${b.vendor}: ${formatCents(b.amount || 0)} | ${b.escalation_stage || 'factuur'} | vervalt ${b.due_date || 'onbekend'}`).join('\n')}
${plans.length > 0 ? `BETALINGSREGELINGEN: ${plans.length} actief` : ''}`.trim();

    const voicePrompt = `Je bent PayBuddy, de persoonlijke financiele maat in PayWatch. Je voert een telefoongesprek met de gebruiker.

TAAL: Spreek ${lang === 'nl' ? 'Nederlands' : 'English'}. Gebruik informeel "je/jij", nooit "u".

STIJL:
- Praat als een vriend, niet als een robot. Kort en duidelijk.
- Noem de gebruiker bij naam (${firstName || 'de gebruiker'}).
- Wees empathisch maar direct. Geef concrete stappen.
- Houd antwoorden kort, max 2-3 zinnen. Dit is een gesprek, geen lezing.
- Nooit em-dashes of ingewikkelde woorden.

KENNIS:
- Je kent de Nederlandse escalatiefases: factuur, herinnering, aanmaning, incasso, deurwaarder
- WIK-kosten: 15% van eerste 2.500 euro (minimum 40 euro)
- NOOIT juridisch advies. Verwijs naar Juridisch Loket (0900-8020).
- NOOIT data verzinnen. Gebruik alleen de onderstaande gegevens.

GEBRUIKERSDATA:
${context}`;

    const firstMsg = firstName
      ? `Hoi ${firstName}! Ik ben PayBuddy. Waar kan ik je mee helpen?`
      : 'Hoi! Ik ben PayBuddy, je financiele maat. Waar kan ik je mee helpen?';

    // Get signed URL from ElevenLabs
    const signedUrlRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        headers: { 'xi-api-key': apiKey },
      }
    );

    if (!signedUrlRes.ok) {
      const err = await signedUrlRes.text();
      console.error('ElevenLabs signed URL error:', err);
      return NextResponse.json({ error: 'Failed to get voice token' }, { status: 500, headers: NO_CACHE });
    }

    const { signed_url } = await signedUrlRes.json();

    return NextResponse.json({
      signedUrl: signed_url,
      overrides: {
        agent: {
          prompt: { prompt: voicePrompt },
          firstMessage: firstMsg,
          language: lang,
        },
      },
      firstName,
      lang,
    }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Voice token error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
