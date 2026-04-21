import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { calculateWIKCosts } from '@/lib/wik';
import { callHaiku } from '@/lib/ai/haiku';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * POST /api/voice/wik-bezwaar
 * Generates a WIK overcharge objection letter and saves it to chat.
 * Called by the draft_wik_bezwaar client tool from the voice agent.
 *
 * Body: { vendor: string, bill_amount: number (euros), claimed_costs: number (euros) }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();

    const vendor = String(body.vendor || '').trim();
    const billAmountEuros = parseFloat(String(body.bill_amount || 0).replace(',', '.'));
    const claimedCostsEuros = parseFloat(String(body.claimed_costs || 0).replace(',', '.'));

    if (!vendor || billAmountEuros <= 0 || claimedCostsEuros <= 0) {
      return NextResponse.json({ error: 'vendor, bill_amount en claimed_costs zijn verplicht' }, { status: 400, headers: NO_CACHE });
    }

    const billAmountCents = Math.round(billAmountEuros * 100);
    const maxAllowedCents = calculateWIKCosts(billAmountCents);
    const maxAllowedEuros = maxAllowedCents / 100;
    const overpaidEuros = Math.max(0, claimedCostsEuros - maxAllowedEuros);

    if (overpaidEuros <= 0) {
      return NextResponse.json({
        overcharged: false,
        summary: `De kosten van ${vendor} vallen binnen het wettelijk maximum. Geen bezwaar nodig.`,
      }, { headers: NO_CACHE });
    }

    // Get user info for the letter
    const supabase = await createServerSupabaseClient();
    const { data: settings } = await supabase
      .from('user_settings')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .single();

    const fullName = [settings?.first_name, settings?.last_name].filter(Boolean).join(' ') || '[Uw naam]';
    const today = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

    // Generate letter with Claude Haiku
    const prompt = `Schrijf een kort, formeel bezwaarschrift in het Nederlands.

Situatie:
- Incassobureau/bedrijf: ${vendor}
- Oorspronkelijk factuurbedrag: €${billAmountEuros.toFixed(2)}
- Geëiste incassokosten: €${claimedCostsEuros.toFixed(2)}
- Wettelijk maximum (WIK): €${maxAllowedEuros.toFixed(2)}
- Teveel gerekend: €${overpaidEuros.toFixed(2)}
- Naam afzender: ${fullName}
- Datum: ${today}

Eisen aan de brief:
- Verwijs naar de Wet normering buitengerechtelijke incassokosten (WIK / BIK, Besluit vergoeding buitengerechtelijke incassokosten)
- Verzoek om het teveel berekende bedrag te corrigeren
- Geef een reactietermijn van 14 dagen
- Vermeld dat bij geen reactie verdere stappen worden overwogen (Juridisch Loket, geschillencommissie)
- Houd het op 1 A4, zakelijk maar niet agressief
- Eindig met "Met vriendelijke groet" en de naam

Antwoord ALLEEN als JSON: { "subject": "onderwerp", "body": "volledige brieftekst" }`;

    const result = await callHaiku(prompt, userId, 'wik_bezwaar', 1200);

    const subject = String(result.subject || `Bezwaar incassokosten — ${vendor}`);
    const letterBody = String(result.body || '').replace(/\\n/g, '\n').trim();

    // Save letter to chat_messages so user can see it
    await supabase.from('chat_messages').insert({
      user_id: userId,
      role: 'assistant',
      content: `📋 **Bezwaarbrief opgesteld**\n\n**Onderwerp:** ${subject}\n\n${letterBody}\n\n---\n_Je kunt deze brief kopiëren en versturen naar ${vendor}. Tip: verstuur aangetekend of per e-mail met leesbevestiging._`,
      metadata: {
        source: 'voice_wik_bezwaar',
        vendor,
        bill_amount: billAmountEuros,
        claimed_costs: claimedCostsEuros,
        max_allowed: maxAllowedEuros,
        overpaid: overpaidEuros,
      },
    });

    return NextResponse.json({
      overcharged: true,
      letter_generated: true,
      subject,
      overpaid: overpaidEuros,
      max_allowed: maxAllowedEuros,
      summary: `Bezwaarbrief opgesteld en in de chat gezet. ${vendor} rekent €${overpaidEuros.toFixed(2)} teveel. De brief verwijst naar de WIK en vraagt om correctie binnen 14 dagen.`,
    }, { headers: NO_CACHE });
  } catch (error) {
    console.error('WIK bezwaar error:', error);
    return NextResponse.json({ error: 'Failed to generate letter' }, { status: 500, headers: NO_CACHE });
  }
}
