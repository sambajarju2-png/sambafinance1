import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { streamChat } from '@/lib/ai/chat-stream';
import { extractBillFromPhoto } from '@/lib/ai/pipeline';
import { extractPdfText } from '@/lib/pdf-extract';
import { formatCents } from '@/lib/bills';

export const maxDuration = 55;

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

    const allowed = await checkRateLimit(userId, 'chat', 20, 60);
    if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429, headers: NO_CACHE });

    // Parse request — either JSON or multipart
    let message = '';
    let extractionContext = '';
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      message = (formData.get('message') as string) || '';
      const file = formData.get('file') as File | null;

      if (file) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        if (file.type.startsWith('image/')) {
          // Image → Gemini Flash extraction
          const base64 = buffer.toString('base64');
          const result = await extractBillFromPhoto(base64, file.type, userId);
          extractionContext = `\n\nDE GEBRUIKER HEEFT ZOJUIST EEN FOTO GEÜPLOAD. Dit is wat ik heb geëxtraheerd:\n${JSON.stringify({
            vendor: result.vendor,
            amount: result.amount_cents ? `€${(result.amount_cents / 100).toFixed(2)}` : 'onbekend',
            due_date: result.due_date || 'onbekend',
            iban: result.iban || 'niet gevonden',
            reference: result.reference || 'niet gevonden',
            escalation_stage: result.escalation_stage || 'factuur',
            category: result.category_hint || 'overig',
          }, null, 2)}\n\nPresenteer dit aan de gebruiker en vraag of het klopt. Toon het overzichtelijk met de bedragen en data. Vraag of ze willen bewerken of bevestigen.`;
        } else if (file.type === 'application/pdf') {
          // PDF → unpdf text extraction
          const text = await extractPdfText(buffer);
          if (text) {
            extractionContext = `\n\nDE GEBRUIKER HEEFT EEN PDF GEÜPLOAD. Dit is de geëxtraheerde tekst (eerste 3000 tekens):\n${text.slice(0, 3000)}\n\nAnalyseer deze tekst. Zoek naar: vendor/afzender, bedrag, vervaldatum, IBAN, referentie, escalatiefase. Presenteer wat je vindt aan de gebruiker en vraag of het klopt.`;
          } else {
            extractionContext = `\n\nDE GEBRUIKER HEEFT EEN PDF GEÜPLOAD maar de tekst kon niet worden geëxtraheerd. Vraag de gebruiker om een foto te maken van de rekening.`;
          }
        }
      }
    } else {
      const body = await req.json();
      message = body.message || '';
    }

    if (!message && !extractionContext) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400, headers: NO_CACHE });
    }

    const supabase = await createServerSupabaseClient();

    // Load user context in parallel
    const [settingsRes, billsRes, plansRes, moodRes, historyRes] = await Promise.all([
      supabase.from('user_settings').select('first_name, gemeente, language, onboarding_profile, scan_preference').eq('user_id', userId).single(),
      supabase.from('bills').select('vendor, amount, due_date, status, escalation_stage, category').eq('user_id', userId).order('due_date', { ascending: true }).limit(50),
      supabase.from('payment_plans').select('id, vendor, total_amount, paid_amount, installment_count, status').eq('user_id', userId).eq('status', 'active'),
      supabase.from('mood_log').select('mood, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(7),
      supabase.from('chat_messages').select('role, content').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    ]);

    const settings = settingsRes.data;
    const bills = billsRes.data || [];
    const plans = plansRes.data || [];
    const moods = moodRes.data || [];
    const history = (historyRes.data || []).reverse();

    const lang = settings?.language || 'nl';
    const firstName = settings?.first_name || '';
    const gemeente = settings?.gemeente || '';
    const stress = (settings?.onboarding_profile as Record<string, unknown>)?.stress || 'onbekend';

    // Load schuldhulp if gemeente is set
    let schuldhulpInfo = '';
    if (gemeente) {
      const { data: hulp } = await supabase.from('gemeente_schuldhulp').select('name, url, type').eq('gemeente', gemeente);
      if (hulp?.length) {
        schuldhulpInfo = hulp.map((h: { name: string; url: string; type: string }) => `- ${h.name} (${h.type}): ${h.url}`).join('\n');
      }
    }

    // Build user context
    const today = new Date();
    const todayStr = today.toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const outstanding = bills.filter(b => b.status !== 'settled');
    const totalOutstanding = outstanding.reduce((sum, b) => sum + (b.amount || 0), 0);
    const urgentBills = outstanding.filter(b => {
      if (!b.due_date) return false;
      const due = new Date(b.due_date);
      const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7 && diffDays >= 0;
    });
    const escalated = outstanding.filter(b => ['herinnering', 'aanmaning', 'incasso', 'deurwaarder'].includes(b.escalation_stage || ''));
    const severe = outstanding.filter(b => ['incasso', 'deurwaarder'].includes(b.escalation_stage || ''));

    const userContext = `
VANDAAG: ${todayStr} (${today.toISOString().split('T')[0]})

GEBRUIKERSPROFIEL:
- Naam: ${firstName || 'onbekend'}
- Taal: ${lang}
- Gemeente: ${gemeente || 'niet ingesteld'}
- Stressniveau: ${stress}/5

REKENINGEN SAMENVATTING:
- Totaal openstaand: ${formatCents(totalOutstanding)}
- Vervalt binnen 7 dagen: ${urgentBills.length}
- In escalatie (herinnering+): ${escalated.length}
- In incasso/deurwaarder: ${severe.length}
- Totaal betaald: ${bills.filter(b => b.status === 'settled').length}

OPENSTAANDE REKENINGEN:
${outstanding.length > 0 ? outstanding.map(b => `- ${b.vendor}: ${formatCents(b.amount || 0)} | ${b.escalation_stage || 'factuur'} | vervalt ${b.due_date || 'onbekend'} | ${b.category || ''}`).join('\n') : 'Geen openstaande rekeningen'}

ACTIEVE BETALINGSREGELINGEN:
${plans.length > 0 ? plans.map((p: { vendor: string; paid_amount: number; total_amount: number; installment_count: number }) => `- ${p.vendor}: ${formatCents(p.paid_amount || 0)} van ${formatCents(p.total_amount || 0)} betaald (${p.installment_count} termijnen)`).join('\n') : 'Geen'}

STEMMING (laatste 7 dagen):
${moods.length > 0 ? moods.map((m: { logged_at: string; mood: string }) => `- ${new Date(m.logged_at).toLocaleDateString('nl-NL')}: ${m.mood}`).join('\n') : 'Geen stemmingsdata'}

LOKALE HULP${gemeente ? ` (${gemeente})` : ''}:
${schuldhulpInfo || 'Geen lokale hulpdata beschikbaar'}`;

    // System prompt
    const systemPrompt = `Je bent PayBuddy, de persoonlijke financiële maat in PayWatch. Je voelt als een rustige, slimme vriend die Nederlands schuldrecht snapt en écht om de gebruiker geeft.

TAAL: Antwoord in ${lang === 'nl' ? 'Nederlands' : 'English'}. Gebruik informeel "je/jij", nooit "u".

PERSOONLIJKHEID:
- Warm, kalm, direct. Als een WhatsApp-gesprek met je slimste vriend.
- Begrijp nuances: stress, uitstelgedrag, opluchting, trots, frustratie.
- Motiveer zonder toxic positivity. Erken gevoelens kort (1 zin), geef dan een helder volgende stap.
- Help organiseren: maak simpele actieplannen, prioriteer rekeningen, vier kleine wins.
- Gebruik de voornaam af en toe, niet elke keer.
- Kort en krachtig. Max 2-4 zinnen normaal, max 6-8 bij complexe hulp.
- Wees opinionated: "Ik zou deze eerst doen, want..." niet "Je zou kunnen overwegen..."

FORMATTING:
- Gebruik markdown voor nadruk: **vet** voor belangrijke bedragen of namen.
- Gebruik lijsten alleen als er 3+ items zijn.
- Schrijf als WhatsApp: korte zinnen, natuurlijke flow. Gebruik regeleinden voor leesbaarheid.
- VERBODEN TEKENS: Gebruik NOOIT de tekens — of – (em-dash of en-dash). Gebruik altijd een gewoon streepje - of een komma.
- Houd antwoorden kort en krachtig. Max 6-8 zinnen, behalve bij complexe uitleg.

REKENINGEN TOEVOEGEN:
- Als een gebruiker een rekening wil toevoegen (via tekst, foto of PDF):
  1. Toon wat je ziet/begrijpt in een duidelijk overzicht
  2. Eindig je bericht met het JSON blok hieronder op EEN REGEL, ZONDER tekst erna:
     |||PENDING_BILL|||{"vendor":"naam","amount_cents":12345,"due_date":"2026-04-25","iban":"NL...","reference":"ref","escalation_stage":"factuur","category":"energie"}|||
  3. BELANGRIJK: Zet het JSON blok op de LAATSTE regel. Schrijf NIETS na het blok. Geen uitleg, geen "klik hier", niets.
  4. Het systeem toont automatisch Bevestig/Bewerken knoppen
  5. Als gebruiker bewerkt: pas de data aan en stuur het JSON blok opnieuw
  6. Als gebruiker bevestigt: het systeem voegt de rekening automatisch toe
  7. amount_cents is ALTIJD in centen (€200 = 20000). due_date in YYYY-MM-DD formaat.
  8. escalation_stage opties: factuur, herinnering, aanmaning, incasso, deurwaarder
  9. category opties: energie, water, telecom, internet, verzekering, overheid, wonen, zorg, vervoer, abonnement, incasso, overig

BUDDY SYSTEEM:
- Als gebruiker zegt "buddy toevoegen" of iets vergelijkbaars:
  1. Vraag de rol (hulpverlener / familie / partner)
  2. Vraag wat de buddy mag zien
  3. Vraag het e-mailadres
  4. Bevestig en stuur uitnodiging

KENNIS:
- Je kent Nederlandse escalatiefases: factuur → herinnering → aanmaning → incasso → deurwaarder
- Je kent ALLEEN de echte data van deze gebruiker (hieronder). Verzin NOOIT rekeningen.
- Je kunt uitleggen: betalingsregelingen, bezwaar, uitstel, WIK-berekeningen.

WIK-CALCULATOR (Wet Incassokosten):
Als een rekening in incasso of deurwaarder staat, BEREKEN de extra kosten:
- 15% over de eerste €2.500 (minimum €40)
- 10% over de volgende €2.500 (€2.500-€5.000)
- 5% over de volgende €5.000 (€5.000-€10.000)
- 1% over de volgende €190.000
- 0.5% over alles boven €200.000 (max €6.775)
Voorbeeld: €200 rekening → WIK = €40 (minimum). Totaal wordt €240.
Voorbeeld: €3.000 rekening → WIK = €375 (€2.500 x 15%) + (€500 x 10%) = €425. Totaal wordt €3.425.
Noem ALTIJD het totaal (origineel + WIK) en zeg dat dit wettelijk vastgelegd is.

BRIEVEN SCHRIJVEN:
Als de gebruiker vraagt om een brief (bezwaar, betalingsregeling, uitstel, bevestiging):
- Vraag over welke rekening het gaat (als niet duidelijk)
- Zeg: "Je kunt een brief laten schrijven via de Acties tab van die rekening. Ga naar Betalingen, tik op [vendor naam], en dan Acties."
- Bied aan om uit te leggen welk type brief het beste past

WELKOMSTBERICHT (eerste bericht, als er geen chatgeschiedenis is):
- Begin met een korte begroeting met naam
- Geef een samenvatting: "Je hebt X rekeningen open (€Y totaal)"
- Als er urgente rekeningen zijn: noem de belangrijkste 1-2
- Eindig met een vraag: "Waar kan ik je mee helpen?"

REGELS:
1. NOOIT juridisch advies. Zeg "dit is geen juridisch advies" + Juridisch Loket (0900-8020).
2. NOOIT schaamte of schuld.
3. NOOIT data verzinnen.
4. Bij veel stress: erken kort + noem professionele hulp (gemeente schuldhulp, Nibud, 113).
5. Elke response eindigt met één duidelijke volgende stap of motiverend moment.
6. Bij incasso/deurwaarder: altijd WIK-kosten noemen + urgentie tonen (maar kalm).
7. Buiten scope: "Daar kan ik je helaas niet mee helpen, maar ik kan je wel helpen met je rekeningen!"

PRIORITERING:
1. Escalatiefase (deurwaarder > incasso > aanmaning > herinnering > factuur)
2. Tijdsdruk (vervalt morgen > vervalt volgende week)
3. Kostenrisico (WIK-impact)
4. Psychologisch effect (kleine wins als motivatie)
Noem altijd max 1-2 rekeningen, niet alles tegelijk.

PROACTIEF:
Als je iets belangrijks ziet dat de gebruiker niet heeft gevraagd, mag je het kort noemen.

BUDGET COACHING:
Als de gebruiker vraagt over budget, uitgaven of besparen:
- Kijk naar de openstaande rekeningen en tel de totale maandelijkse kosten op
- Categoriseer: vaste lasten (energie, water, internet, verzekering) vs variabel (abonnementen)
- Geef concreet advies: "Je vaste lasten zijn ongeveer €X per maand. Het meeste gaat naar energie."
- Suggereer waar ze kunnen besparen: overstappen, opzeggen, onderhandelen
- Als er betalingsregelingen lopen: bereken het maandelijks effect ("Je betaalt €X/maand aan regelingen")
- Noem ALTIJD concrete bedragen, niet alleen percentages

MOTIVATIE:
Pas je motivatiestijl aan op de situatie:
- Bij eerste gesprek: welkomend en overzichtelijk. "Je hebt X rekeningen, laten we beginnen."
- Bij veel stress/hoge schuld: empathisch maar hoopvol. "Dit voelt veel, maar je bent al bezig. Laten we stap voor stap kijken."
- Bij voortgang (betaalde rekeningen): vier de win! "Nice! Je hebt €X afgetikt. Dat scheelt potentieel €Y aan incassokosten."
- Bij terugval (nieuwe escalatie): kalm en actiegericht. "Er is een nieuwe herinnering. Pak het nu aan, dan blijft het klein."
- Gebruik de stemming (mood data) als die beschikbaar is. Bij slechte stemming: korter en zachter. Bij goede stemming: energieker.
- Noem concrete besparingen door WIK-kosten te vermijden als motivatie

GEBRUIKERSDATA:
${userContext}${extractionContext}`;

    // Build messages array for Haiku
    const apiMessages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message || 'De gebruiker heeft een bestand geüpload (zie extractiecontext in systeem prompt).' },
    ];

    // Save user message
    await supabase.from('chat_messages').insert({
      user_id: userId,
      role: 'user',
      content: message || '[bestand geüpload]',
      attachments: extractionContext ? [{ type: 'extraction', summary: extractionContext.slice(0, 500) }] : [],
    });

    // Stream response
    const stream = await streamChat(systemPrompt, apiMessages, userId);

    // Collect the full response to save it after streaming
    const [streamForClient, streamForSave] = stream.tee();

    // Save assistant response async after stream completes
    const saveResponse = async () => {
      const reader = streamForSave.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.type === 'done') fullText = parsed.fullText;
            } catch {}
          }
        }
        if (fullText) {
          await supabase.from('chat_messages').insert({
            user_id: userId,
            role: 'assistant',
            content: fullText,
          });
        }
      } catch {}
    };
    saveResponse().catch(() => {});

    // Generate dynamic chips
    const chips = generateChips(outstanding, urgentBills, escalated, plans, bills, lang);

    return new Response(streamForClient, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Chat-Chips': JSON.stringify(chips),
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: NO_CACHE });
  }
}

function generateChips(
  outstanding: { escalation_stage?: string | null }[],
  urgent: unknown[],
  escalated: unknown[],
  plans: unknown[],
  allBills: unknown[],
  lang: string
): string[] {
  const nl = lang === 'nl';
  const chips: string[] = [];

  // Priority 1: Most relevant action based on situation
  const severe = outstanding.filter(b => ['incasso', 'deurwaarder'].includes(b.escalation_stage || ''));

  if (severe.length > 0) {
    chips.push(nl ? 'Bereken extra kosten' : 'Calculate extra costs');
    chips.push(nl ? 'Schrijf een brief' : 'Draft a letter');
  } else if (escalated.length > 0) {
    chips.push(nl ? 'Wat moet ik eerst doen?' : 'What should I do first?');
  }

  if (urgent.length > 0 && chips.length < 2) {
    chips.push(nl ? 'Plan mijn week' : 'Plan my week');
  }

  if (allBills.length === 0) {
    chips.push(nl ? 'Rekening toevoegen' : 'Add a bill');
    chips.push(nl ? 'Hoe werkt PayWatch?' : 'How does PayWatch work?');
  } else {
    chips.push(nl ? 'Rekening toevoegen' : 'Add a bill');
  }

  if (plans.length > 0 && chips.length < 4) {
    chips.push(nl ? 'Hoe gaat mijn regeling?' : "How's my payment plan?");
  }

  const settled = allBills.filter((b: unknown) => (b as { status: string }).status === 'settled');
  if (settled.length > 0 && chips.length < 4) {
    chips.push(nl ? 'Hoeveel bespaar ik?' : 'How much am I saving?');
  }

  if (chips.length < 4) {
    chips.push(nl ? 'Hulp bij schulden' : 'Help with debt');
  }

  return chips.slice(0, 4);
}
