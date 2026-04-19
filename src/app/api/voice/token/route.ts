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

    const context = `
GEBRUIKER: ${firstName || 'onbekend'}
TAAL: ${lang === 'nl' ? 'Nederlands' : 'English'}
REKENINGEN: ${outstanding.length} openstaand (${formatCents(totalOutstanding)} totaal)
ESCALATIE: ${escalated.length} in escalatie
${outstanding.slice(0, 5).map(b => `- ${b.vendor}: ${formatCents(b.amount || 0)} | ${b.escalation_stage || 'factuur'} | vervalt ${b.due_date || 'onbekend'}`).join('\n')}
${plans.length > 0 ? `BETALINGSREGELINGEN: ${plans.length} actief` : ''}`.trim();

    const voicePrompt = `Je bent PayBuddy. Je voert een telefoongesprek met ${firstName || 'de gebruiker'}.

JE BENT IN EEN TELEFOONGESPREK. Niet een chat. Praat kort.

REGELS:
- Max 1-2 zinnen per beurt. Nooit meer dan 3.
- Spreek ${lang === 'nl' ? 'informeel Nederlands (je/jij)' : 'English'}.
- Praat als een warme, kalme vriend. Niet als een callcenter.
- Reageer eerst op het gevoel, dan op de inhoud.
- Stel steeds EEN vraag, wacht dan.
- Gebruik naam "${firstName}" af en toe, niet elke keer.
- Wacht even na je antwoord. Laat de gebruiker makkelijk interrumperen.
- Bij onderbreking: reageer op wat ze zeggen, niet op je vorige zin.
- Nooit opsommingen. Zeg "je hebt drie rekeningen, de belangrijkste is..." niet alle drie.
- Nooit em-dashes. Nooit formeel. Nooit "wij adviseren u".
- NOOIT juridisch advies. Zeg "bel het Juridisch Loket, 0900-8020".
- Gebruik ALLEEN de data hieronder. Verzin niks.

DATA:
${context}`;

    const firstMsg = firstName
      ? `Hoi ${firstName}! Hoe gaat het? Waar kan ik je mee helpen?`
      : 'Hoi! Ik ben PayBuddy. Hoe gaat het vandaag?';

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
