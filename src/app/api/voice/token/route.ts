import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/bills';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/voice/token
 * Returns signedUrl (WebSocket) + dynamic user context overrides.
 * signedUrl forces WebSocket transport — stable on iOS Safari PWA.
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

    const gemeente = settings?.gemeente || '';

    // MINIMAL override — only user context. All behavior rules come from the dashboard prompt.
    // The override REPLACES the dashboard prompt, so we include the essential rules + user data.
    const voicePrompt = `Je bent PayBuddy — die ene vriend die alles weet over geld maar nooit oordeelt. Kort, warm, natuurlijk.

DATUM: ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}

STIJL: Max 1 zin per beurt. Bevestig kort. Zeg "even kijken..." voor tools. Eén vraag per beurt. Spreek bedragen uit. Pas toon aan op situatie.

TOOL REGELS: JE MAG NIET ANTWOORDEN ZONDER TOOL RESULTAAT. Zeg PAS "staat erin" NADAT de tool het resultaat teruggeeft. Geen vierkante haken. Geen markdown.

GEBRUIKER: ${firstName || 'onbekend'}${gemeente ? ` | Gemeente: ${gemeente}` : ''}
REKENINGEN: ${outstanding.length} openstaand (${formatCents(totalOutstanding)} totaal), ${escalated.length} in escalatie
${outstanding.slice(0, 3).map(b => `${b.vendor}: ${formatCents(b.amount || 0)} (${b.escalation_stage || 'factuur'})`).join(', ')}

FASES: factuur, herinnering, aanmaning, incasso, deurwaarder.
WIK: 15% eerste €2.500 (min €40). Schuldhulp: 0800-8115.`;

    const firstMsg = firstName
      ? `Hoi ${firstName}! Fijn dat je belt. Waar kan ik je mee helpen?`
      : 'Hoi! Fijn dat je belt. Waar kan ik je mee helpen?';

    // Generate signed URL — forces WebSocket transport (stable on iOS Safari PWA)
    const signedUrlRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey } }
    );

    if (!signedUrlRes.ok) {
      const err = await signedUrlRes.text();
      console.error('ElevenLabs signed URL error:', err);
      return NextResponse.json({ error: 'Failed to get voice token', details: err }, { status: 500, headers: NO_CACHE });
    }

    const { signed_url } = await signedUrlRes.json();

    return NextResponse.json({
      signedUrl: signed_url,
      agentId, // fallback
      overrides: {
        agent: {
          prompt: { prompt: voicePrompt },
          firstMessage: firstMsg,
          language: lang,
        },
      },
    }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Voice token error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
