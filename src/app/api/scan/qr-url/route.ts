import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';

/**
 * POST /api/scan/qr-url
 * Takes a URL from a QR code, fetches the payment page, and extracts bill data.
 * Follows redirects to reach the final page (e.g., qr6.ideal.nl → factuurinzien.nl).
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400, headers: NO_CACHE });
    }

    // Step 1: Fetch the URL, follow all redirects
    let finalUrl = url;
    let htmlContent = '';

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      finalUrl = response.url;
      htmlContent = await response.text();
    } catch {
      return NextResponse.json({
        error: 'Kon de betaalpagina niet ophalen. Probeer de link handmatig te openen.',
        payment_url: url,
      }, { status: 422, headers: NO_CACHE });
    }

    // Step 2: Clean HTML
    const cleanedText = cleanHTML(htmlContent);

    if (!cleanedText || cleanedText.length < 20) {
      return NextResponse.json({
        error: 'Pagina bevat geen leesbare content',
        payment_url: finalUrl,
      }, { status: 422, headers: NO_CACHE });
    }

    // Step 3: Use AI to extract payment data
    const extraction = await extractPaymentData(cleanedText, finalUrl);

    return NextResponse.json({
      extraction: {
        ...extraction,
        payment_url: finalUrl,
      },
      source_url: url,
      final_url: finalUrl,
    }, { headers: NO_CACHE });

  } catch (err) {
    console.error('QR URL scan error:', err);
    return NextResponse.json({ error: 'Er ging iets mis bij het scannen' }, { status: 500, headers: NO_CACHE });
  }
}

function cleanHTML(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<\/(div|p|tr|li|h[1-6]|section|article|header|footer)>/gi, '\n');
  text = text.replace(/<(br|hr)\s*\/?>/gi, '\n');
  text = text.replace(/<td[\s>]/gi, ' | ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&euro;/g, '€');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  text = text.trim();
  return text.slice(0, 8000);
}

async function extractPaymentData(pageText: string, pageUrl: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return fallbackExtraction(pageText);
  }

  const prompt = `Extract payment/invoice information from this Dutch payment page content. This is from a QR code on a Dutch invoice that redirected to a payment page.

URL: ${pageUrl}

Page content:
---
${pageText}
---

Extract and return a JSON object with these fields (use null if not found):
- vendor: The company/organization name (the one sending the invoice)
- amount_cents: The total amount in cents (e.g., €127,50 = 12750). Parse Dutch format (comma = decimal).
- iban: IBAN number if visible
- reference: Invoice number, payment reference, or kenmerk
- due_date: Due date in YYYY-MM-DD format if found
- category_hint: One of: wonen, nutsvoorzieningen, zorg, verzekeringen, telecom, overheid, vervoer, leningen, winkels, abonnementen, gezin, zakelijk, incasso_kosten, overig
- description: Brief description of what the invoice is for

Return ONLY the JSON object, no other text.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error('Anthropic API error:', res.status, await res.text());
      return fallbackExtraction(pageText);
    }

    const data = await res.json();
    const text = data.content?.[0]?.type === 'text' ? data.content[0].text : '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        vendor: parsed.vendor || null,
        amount_cents: typeof parsed.amount_cents === 'number' ? parsed.amount_cents : null,
        iban: parsed.iban || null,
        reference: parsed.reference || null,
        due_date: parsed.due_date || null,
        category_hint: parsed.category_hint || 'overig',
        description: parsed.description || null,
      };
    }
  } catch (err) {
    console.error('AI extraction error:', err);
  }

  return fallbackExtraction(pageText);
}

function fallbackExtraction(text: string) {
  let vendor: string | null = null;
  let amount_cents: number | null = null;
  let iban: string | null = null;
  let reference: string | null = null;

  const ibanMatch = text.match(/\b(NL\d{2}\s?[A-Z]{4}\s?\d{4}\s?\d{4}\s?\d{2})\b/i);
  if (ibanMatch) iban = ibanMatch[1].replace(/\s/g, '');

  const amountMatch = text.match(/[€]\s?(\d{1,6}[.,]\d{2})|EUR\s?(\d{1,6}[.,]\d{2})/i);
  if (amountMatch) {
    const numStr = (amountMatch[1] || amountMatch[2]).replace('.', '').replace(',', '.');
    amount_cents = Math.round(parseFloat(numStr) * 100);
  }

  const refMatch = text.match(/(?:kenmerk|referentie|factuurnummer|betalingskenmerk)[:\s]+([A-Z0-9\-\.\/]{4,30})/i);
  if (refMatch) reference = refMatch[1].trim();

  return {
    vendor,
    amount_cents,
    iban,
    reference,
    due_date: null,
    category_hint: 'overig',
    description: null,
  };
}
