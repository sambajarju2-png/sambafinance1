import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { income, expenses, disposable, kids, hasPart, gemeente, lang } = await req.json();

  const incFmt = `€${(income / 100).toFixed(0)}`;
  const expFmt = `€${(expenses / 100).toFixed(0)}`;
  const dispFmt = `€${(disposable / 100).toFixed(0)}`;

  const prompt = `Je bent PayWatch, een Nederlandse app die huishoudens helpt rekeningen te volgen en schulden te voorkomen.

Een nieuwe gebruiker heeft net de onboarding afgerond. Schrijf een persoonlijk, warm welkomstbericht van MAXIMAAL 3 zinnen in ${lang === 'nl' ? 'het Nederlands' : 'English'}.

Hun gegevens:
- Maandinkomen: ${incFmt}
- Vaste lasten: ${expFmt}
- Vrij besteedbaar: ${dispFmt}
- Partner: ${hasPart ? 'ja' : 'nee'}
- Kinderen: ${kids}
- Gemeente: ${gemeente || 'onbekend'}

Regels:
- Wees warm en bemoedigend, niet schools of neerbuigend
- Als het inkomen laag is of het vrij besteedbaar bedrag krap: erken dat het zwaar kan zijn, maar benadruk dat ze nu grip krijgen
- Als het inkomen prima is: geef een compliment en zeg dat PayWatch helpt het zo te houden
- Noem CONCREET wat PayWatch voor hen gaat doen (bijv. inbox scannen, waarschuwingen bij escalatie)
- Geen opsommingen, geen bullet points — gewoon vloeiende tekst
- Maximaal 3 zinnen`;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text || '';

    return NextResponse.json({ insight: text.trim() });
  } catch {
    // Fallback: return a generic message
    const fallback = lang === 'nl'
      ? `Met een vrij besteedbaar bedrag van ${dispFmt} per maand is het goed dat je nu overzicht krijgt. PayWatch scant je inbox op facturen en waarschuwt je voordat een rekening escaleert naar incasso.`
      : `With ${dispFmt} disposable income per month, it's great that you're getting an overview now. PayWatch scans your inbox for invoices and alerts you before a bill escalates to collections.`;

    return NextResponse.json({ insight: fallback });
  }
}
