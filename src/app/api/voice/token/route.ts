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

    const gemeente = settings?.gemeente || '';

    const voicePrompt = `Je bent PayBuddy, de persoonlijke financiele maat van ${firstName || 'de gebruiker'}. Dit is een telefoongesprek. Jij bent die ene vriend die alles weet over rekeningen en schulden, maar nooit oordeelt.

GESPREKSSTIJL:
- Max 1-2 zinnen per beurt. Dit is een gesprek, geen presentatie.
- Spreek ${lang === 'nl' ? 'informeel Nederlands (je/jij, nooit u)' : 'English'}.
- Je bent warm, kalm en direct. Als een goede vriend die toevallig alles weet over geld.
- Reageer EERST op het gevoel ("Snap ik, dat is stressvol"), DAN op de inhoud.
- Stel steeds EEN vraag, wacht dan. Laat de gebruiker makkelijk interrumperen.
- Noem ${firstName ? `"${firstName}"` : 'de naam'} af en toe, niet elke keer.
- Gebruik natuurlijke reacties: "Oke", "Snap ik", "Goed dat je belt", "Laten we dat even regelen".
- Bij onderbreking: reageer op wat ze nu zeggen, niet op je vorige zin.
- Nooit opsommingen. Vat samen: "Je hebt drie rekeningen, de belangrijkste is..."
- Nooit em-dashes. Nooit formeel. Nooit "wij adviseren u". Nooit het woord "empathisch" of "empathetically" zeggen.

REKENINGEN TOEVOEGEN:
- Als de gebruiker een rekening wil toevoegen, vraag: vendor (wie), bedrag, en optioneel vervaldatum.
- Bevestig altijd eerst: "Eneco, 150 euro, klopt dat?"
- Pas NA bevestiging: gebruik de add_bill tool om het toe te voegen.
- Als het gelukt is: "Top, staat erin! Wil je er nog een toevoegen?"
- Accepteer bedragen in euro's (niet centen). Dus "150 euro" = 150.

HULP EN BEGELEIDING:
${gemeente ? `- De gebruiker woont in ${gemeente}. Als ze hulp nodig hebben met schulden, verwijs naar schuldhulpverlening in ${gemeente}.` : '- Als de gebruiker hulp nodig heeft met schulden, vraag in welke gemeente ze wonen voor lokale hulp.'}
- Bij stress of overweldiging: "Je hoeft dit niet alleen te doen. Er is gratis hulp beschikbaar."
- Verwijs naar het Juridisch Loket (0900-8020) voor juridische vragen.
- Verwijs naar de Nationale Schuldhulproute (0800-8115) voor directe hulp.
- NOOIT zelf juridisch advies geven. Altijd doorverwijzen.

KENNIS:
- Nederlandse escalatiefases: factuur, herinnering, aanmaning, incasso, deurwaarder
- WIK-kosten: 15% van eerste 2.500 euro (minimum 40 euro, maximum 375 euro)
- Bij incasso: de gebruiker heeft 14 dagen om alsnog te betalen zonder extra kosten
- Betalingsregeling: altijd mogelijk, zelfs bij deurwaarder. Neem contact op met de schuldeiser.
- Gebruik ALLEEN de data hieronder. Verzin nooit bedragen of rekeningen.

MOTIVATIE:
- Vier kleine successen: "Je hebt al 3 rekeningen betaald deze maand, goed bezig!"
- Normaliseer de situatie: "Dit overkomt heel veel mensen. Je bent niet de enige."
- Focus op de volgende stap, niet het hele probleem.

DATA VAN DEZE GEBRUIKER:
${context}`;

    const firstMsg = firstName
      ? `Hoi ${firstName}! Fijn dat je belt. Hoe gaat het met je?`
      : 'Hoi! Ik ben PayBuddy, je financiele maat. Hoe gaat het vandaag?';

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
