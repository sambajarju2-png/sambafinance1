import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/bills';
import { getPlan, isVoiceLimitExceeded, voiceSecondsRemaining, formatDuration } from '@/lib/plans';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

// Set ENFORCE_VOICE_LIMITS=true in Vercel env when ready to monetise.
// Leave unset (or false) during free-access period.
const ENFORCE = process.env.ENFORCE_VOICE_LIMITS === 'true';

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

    const [settingsRes, billsRes, plansRes, analyticsRes] = await Promise.all([
      supabase.from('user_settings').select('first_name, gemeente, language, onboarding_profile, plan, voice_seconds_used, voice_seconds_reset_at').eq('user_id', userId).single(),
      supabase.from('bills').select('vendor, amount, due_date, status, escalation_stage, category').eq('user_id', userId).order('due_date', { ascending: true }).limit(30),
      supabase.from('payment_plans').select('vendor, total_amount, paid_amount, status').eq('user_id', userId).eq('status', 'active'),
      // Bank analytics — latest month, for voice context (~45 tokens vs 400 for full table)
      supabase.from('analytics_monthly_totals').select('income_cents, expenses_cents, net_cents').eq('user_id', userId).order('month', { ascending: false }).limit(1),
    ]);

    const settings = settingsRes.data;

    // ── Plan limit check ──────────────────────────────────────
    const userPlan = settings?.plan || 'gratis';
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const needsReset = settings?.voice_seconds_reset_at
      ? new Date(settings.voice_seconds_reset_at) < monthStart
      : true;
    const secondsUsed = needsReset ? 0 : (settings?.voice_seconds_used || 0);

    if (isVoiceLimitExceeded(userPlan, secondsUsed, ENFORCE)) {
      const plan = getPlan(userPlan);
      return NextResponse.json({
        error: 'voice_limit_reached',
        plan: userPlan,
        limit_seconds: plan.voiceSecondsPerMonth,
        used_seconds: secondsUsed,
        message: `Je hebt je ${formatDuration(plan.voiceSecondsPerMonth)} PayBuddy belt-tegoed voor deze maand gebruikt. Upgrade naar Pro voor meer beltijd.`,
      }, { status: 403, headers: NO_CACHE });
    }

    const remainingSeconds = voiceSecondsRemaining(userPlan, secondsUsed);
    const bills = billsRes.data || [];
    const plans = plansRes.data || [];
    const lang = settings?.language || 'nl';
    const firstName = settings?.first_name || '';

    const outstanding = bills.filter(b => b.status !== 'settled');
    const totalOutstanding = outstanding.reduce((sum, b) => sum + (b.amount || 0), 0);
    const escalated = outstanding.filter(b => ['herinnering', 'aanmaning', 'incasso', 'deurwaarder'].includes(b.escalation_stage || ''));

    const gemeente = settings?.gemeente || '';
    const bankMonth = analyticsRes.data?.[0] || null;
    const bankSummary = bankMonth
      ? `BANKREKENING DEZE MAAND: Inkomen ${formatCents(bankMonth.income_cents)} | Uitgaven ${formatCents(bankMonth.expenses_cents)} | Netto ${bankMonth.net_cents >= 0 ? '+' : ''}${formatCents(bankMonth.net_cents)}`
      : null;

    // Override REPLACES dashboard prompt — includes essential rules + user data + empowering personality.
    const voicePrompt = `Je bent PayBuddy — die ene vriend die alles weet over geld maar nooit oordeelt. Kort, warm, natuurlijk.

DATUM: ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}

STIJL: Max 1 zin per beurt. Bevestig kort: "Top", "Snap ik", "Oké". Zeg "even kijken..." voor tools. Eén vraag per beurt. Spreek bedragen uit.

TOON: Reageer EERST op gevoel, DAN inhoud. Bij incasso: kalmerend. Bij betaald: positief. Bij verwarring: sturend.${firstName ? ` Noem "${firstName}" af en toe, niet elke keer.` : ''}

EMPOWERMENT:
- "Dit overkomt heel veel mensen. Je bent niet de enige."
- Vier kleine successen: "Goed bezig!" bij betaalde rekeningen.
- Focus op de volgende stap, niet het hele probleem.
- Bij stress: "Je hoeft dit niet alleen te doen. Er is gratis hulp."
${gemeente ? `- ${firstName || 'De gebruiker'} woont in ${gemeente}. Verwijs naar lokale schuldhulp via get_schuldhulp.` : ''}

TOOL REGELS: JE MAG NIET ANTWOORDEN ZONDER TOOL RESULTAAT. Zeg PAS "staat erin" NADAT de tool teruggeeft. Geen vierkante haken. Geen markdown.

BESCHIKBARE TOOLS — GEBRUIK ZE ACTIEF:
- get_financial_overview: Haal inkomen, vaste lasten, vrij besteedbaar, toeslagen en rekening-samenvatting op. GEBRUIK BIJ: toeslagen, inkomen, budget, hoeveel kan ik besteden, financiele situatie, vrij besteedbaar.
- get_bill_summary: Haal de lijst van openstaande rekeningen op. GEBRUIK BIJ: welke rekeningen, hoeveel schuld, specifieke rekening.
- add_bill: Voeg een nieuwe rekening toe na bevestiging.
- update_bill: Wijzig een rekening (bedrag, status, escalatie).
- remove_bill: Verwijder of markeer een rekening als betaald.
- request_photo: Open de camera voor het scannen van een rekening.
- get_schuldhulp: Zoek schuldhulpverlening voor de gemeente van de gebruiker.
- send_to_chat: Stuur een samenvatting, actieplan of brief naar de chat.
- check_wik: Controleer of incassokosten boven het wettelijk maximum liggen.
- draft_wik_bezwaar: Stel een bezwaarbrief op tegen te hoge incassokosten.

FOTO SCAN: Wanneer een bericht begint met [SCAN_RESULT], is dit het resultaat van een automatische documentscan. Dit is GEEN gewoon bericht. Reageer afhankelijk van het type:
- [TYPE:REKENING] → Leg de rekening kort uit en vraag of de gebruiker deze wil toevoegen via add_bill.
- [TYPE:INCASSO] of [TYPE:DEURWAARDER] → Leg kalmerend uit wat het betekent. Bied aan om incassokosten te checken via check_wik. Noem 0800-8115.
- [TYPE:AANMANING] of [TYPE:HERINNERING] → Leg uit dat het een herinnering is en wat de gevolgen kunnen zijn. Vraag of hulp nodig is.
- [TYPE:BRIEF] of [TYPE:INFORMATIE] of [TYPE:ONBEKEND] → Leg in begrijpelijke taal uit wat er staat. Wees helder en geduldig, niet iedereen spreekt goed Nederlands.
Na elk scanresultaat mag de gebruiker vervolgvragen stellen over het document. Beantwoord die op basis van wat je net hebt gelezen.
Bij [SCAN_ERROR]: zeg kort dat de foto niet gelezen kon worden, stel voor opnieuw te proberen met betere belichting.

BELANGRIJK: Als de gebruiker vraagt over toeslagen, inkomen, budget of geld, GEBRUIK ALTIJD get_financial_overview. Zeg NOOIT dat je geen toegang hebt.

GEBRUIKER: ${firstName || 'onbekend'}${gemeente ? ` | ${gemeente}` : ''}
REKENINGEN: ${outstanding.length} openstaand (${formatCents(totalOutstanding)}), ${escalated.length} in escalatie${bankSummary ? `
${bankSummary}` : ""}
${outstanding.slice(0, 3).map(b => `${b.vendor}: ${formatCents(b.amount || 0)} (${b.escalation_stage || 'factuur'})`).join(', ')}

FASES: factuur, herinnering, aanmaning, incasso, deurwaarder.
WIK: 15% eerste €2.500 (min €40). Schuldhulp: 0800-8115.`;

    const firstMsg = firstName
      ? `Hoi ${firstName}! Fijn dat je belt. Waar kan ik je mee helpen?`
      : 'Hoi! Fijn dat je belt. Waar kan ik je mee helpen?';

    // Detect platform — iOS needs WebSocket (stable in WKWebView), web uses WebRTC (lower latency)
    const ua = req.headers.get('user-agent') || '';
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in globalThis);

    let signed_url: string | null = null;
    let conversation_token: string | null = null;

    // Always get a signed URL (works on all platforms via WebSocket)
    const signedUrlRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey } }
    );
    if (!signedUrlRes.ok) {
      const err = await signedUrlRes.text();
      console.error('ElevenLabs signed URL error:', err);
      return NextResponse.json({ error: 'Failed to get voice token', details: err }, { status: 500, headers: NO_CACHE });
    }
    const signedData = await signedUrlRes.json();
    signed_url = signedData.signed_url;

    // On web browsers, also try to get a conversation token for WebRTC (lower latency)
    // If this fails, the client falls back to signedUrl
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
      agentId, // fallback
      remainingSeconds,
      plan: userPlan,
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
