import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/bills';
import { languageName } from '@/lib/ai/languages';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/checkin/token
 * Starts a PROACTIVE check-in session (PayBuddy calls the user).
 *
 * Same ElevenLabs agent as the reactive call (same voices, tools, kennisbank),
 * but sends the CHECK-IN prompt as the override. Reactive vs check-in is purely
 * which prompt we send here. The agent's dashboard prompt stays the reactive one.
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

    const [settingsRes, billsRes] = await Promise.all([
      supabase.from('user_settings').select('first_name, gemeente, language').eq('user_id', userId).single(),
      supabase.from('bills').select('vendor, amount, status, escalation_stage').eq('user_id', userId).order('due_date', { ascending: true }).limit(30),
    ]);

    const settings = settingsRes.data;
    const lang = settings?.language || 'nl';
    const firstName = settings?.first_name || '';
    const gemeente = settings?.gemeente || '';
    const langName = languageName(lang);

    const bills = billsRes.data || [];
    const outstanding = bills.filter(b => b.status !== 'settled');
    const totalOutstanding = outstanding.reduce((sum, b) => sum + (b.amount || 0), 0);
    const escalated = outstanding.filter(b => ['herinnering', 'aanmaning', 'incasso', 'deurwaarder'].includes(b.escalation_stage || ''));
    const billSummary = outstanding.length
      ? `${outstanding.length} openstaand (${formatCents(totalOutstanding)}), ${escalated.length} in escalatie. ${outstanding.slice(0, 3).map(b => `${b.vendor}: ${formatCents(b.amount || 0)} (${b.escalation_stage || 'factuur'})`).join(', ')}`
      : 'geen openstaande rekeningen';

    // v2: pull the last agreed next step from checkin_continuity. Empty for now.
    const lastNextStep = '';

    const languageDirective = lang !== 'nl'
      ? `\nTAAL: Spreek en antwoord ALLEEN in ${langName}, ongeacht de taal van deze instructies. Houd Nederlandse vakwoorden exact zoals ze zijn: factuur, herinnering, aanmaning, incasso, deurwaarder, beslagvrije voet, schuldhulp, toeslagen, WIK, gemeente, PayBuddy.\n`
      : '';

    const checkinPrompt = `Je bent PayBuddy, die ene vriend die alles weet over geld maar nooit oordeelt. Je belt ${firstName || 'de gebruiker'} voor een korte check-in. Kort, warm, natuurlijk.
${languageDirective}
DIT GESPREK:
- Jij belt de gebruiker, niet andersom. Een vriendelijke check-in, geen verkoop, geen controle.
- Houd het kort: maximaal drie minuten.
- Doel: horen hoe het gaat en samen een concrete stap vinden die helpt om rekeningen of schulden te verlagen.

STIJL:
- Max 1 zin per beurt. Een vraag per beurt, nooit twee tegelijk.
- Spreek bedragen uit: "vierhonderd euro", niet "400 euro".
- Bevestig kort: "Mooi", "Snap ik", "Oke", "Duidelijk".
- Toon: rustig en warm. Nooit oordelen. Nooit "je had eerder moeten".

GESPREK:
1. Open warm met de naam.${lastNextStep ? ` Vraag kort hoe het ging: "Vorige keer wilde je ${lastNextStep}, hoe ging dat?"` : ''}
2. Vraag rustig: "Hoe gaat het op dit moment?" Luister.
3. Vraag: "Hoe kan PayWatch je helpen om je rekeningen of schulden te verlagen?" Zoek samen een concrete stap.
4. Als hulp in de buurt past, gebruik get_schuldhulp voor ${gemeente || 'de gemeente'}. Noem altijd 0800-8115 als gratis ingang.
5. Spreek samen een concrete vervolgstap af. Sluit warm af en zeg dat je je de volgende keer weer meldt.

NOOIT:
- Vraag nooit "waarom heb je schulden". Geen oordeel, geen verwijt.
- Geen vierkante haken, geen markdown, geen opsommingen.
- Herhaal geen vragen die al beantwoord zijn.

SEINTJE AAN HULPVERLENER:
- Als de gebruiker aangeeft dat het echt zwaar is of dat ze er alleen voor staan, vraag rustig: "Wil je dat ik je hulpverlener een seintje geef, zodat zij contact met je opnemen?"
- Alleen bij ja: gebruik flag_for_support met severity "struggling". Zeg daarna: "Ik heb het doorgegeven, ze nemen contact op."
- Dwing nooit. Bij nee: respecteer dat en ga rustig door of sluit af.

ALS IEMAND ZICH NIET VEILIG VOELT:
- Als de gebruiker aangeeft niet meer te willen leven of zichzelf iets aan te willen doen, reageer rustig en warm, oordeel niet.
- Zeg een keer: "Als je nu met iemand wil praten, bel 113. Dat kan dag en nacht, gratis."
- Probeer dit niet zelf op te lossen en stel geen inschattingsvragen. Gebruik flag_for_support met severity "unsafe", en sluit het gesprek rustig en zacht af.

TOOL REGELS: Antwoord niet zonder tool resultaat. Wacht altijd op de tool response. Zeg pas "doorgegeven" of "staat erin" nadat de tool teruggeeft.

GEBRUIKER: ${firstName || 'onbekend'}${gemeente ? ` | ${gemeente}` : ''}
REKENINGEN: ${billSummary}
WIK: 15% eerste EUR 2.500 (min EUR 40). Schuldhulp: 0800-8115.`;

    const greet = (n: string): string => {
      const s = n ? ` ${n}` : '';
      switch (lang) {
        case 'en': return `Hi${s}, it's PayBuddy. Just checking in for a moment, how are things going?`;
        case 'pl': return `Cześć${s}, tu PayBuddy. Dzwonię tylko, żeby zapytać, jak się masz?`;
        case 'tr': return `Selam${s}, ben PayBuddy. Sadece nasıl olduğunu sormak için aradım, nasıl gidiyor?`;
        case 'fr': return `Salut${s}, c'est PayBuddy. Je t'appelle juste pour prendre de tes nouvelles, comment ça va ?`;
        case 'ar': return `مرحبا${s}، أنا PayBuddy. أتصل فقط للاطمئنان عليك، كيف تسير الأمور؟`;
        default:   return `Hoi${s}, met PayBuddy. Ik bel even om te horen hoe het met je gaat, alles goed?`;
      }
    };
    const firstMsg = greet(firstName);

    const ua = req.headers.get('user-agent') || '';
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in globalThis);

    const signedUrlRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey } }
    );
    if (!signedUrlRes.ok) {
      const err = await signedUrlRes.text();
      console.error('ElevenLabs signed URL error (check-in):', err);
      return NextResponse.json({ error: 'Failed to get voice token', details: err }, { status: 500, headers: NO_CACHE });
    }
    const signedData = await signedUrlRes.json();
    const signed_url = signedData.signed_url;

    let conversation_token: string | null = null;
    if (!isIOS) {
      try {
        const tokenRes = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
          { headers: { 'xi-api-key': apiKey } }
        );
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          conversation_token = tokenData.token;
        }
      } catch {
        // WebRTC token failed — signedUrl will be used as fallback
      }
    }

    return NextResponse.json({
      signedUrl: signed_url,
      conversationToken: conversation_token,
      agentId,
      overrides: {
        agent: {
          prompt: { prompt: checkinPrompt },
          firstMessage: firstMsg,
          language: lang,
        },
      },
    }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Check-in token error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
