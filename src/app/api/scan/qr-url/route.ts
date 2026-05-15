import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';

/**
 * POST /api/scan/qr-url
 * Takes a URL from a QR code, follows redirects to get the final payment URL.
 * Most Dutch payment portals block scraping, so we just capture the payment link
 * and let the user photo-scan the invoice for data extraction.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  // GDPR Art. 18: block processing for restricted accounts
  const { isAccountRestricted } = await import('@/lib/auth');
  if (await isAccountRestricted(userId)) {
    return NextResponse.json({ error: 'Account is bevroren' }, { status: 403 });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400, headers: NO_CACHE });
    }

    // Follow redirects to get the final payment URL
    let finalUrl = url;
    let htmlContent = '';
    let fetchSucceeded = false;

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'nl-NL,nl;q=0.9',
        },
        signal: AbortSignal.timeout(10000),
      });

      finalUrl = response.url;
      htmlContent = await response.text();
      fetchSucceeded = true;
    } catch {
      // Redirect follow failed — still return original URL
    }

    // Try to extract basic data from HTML (works on simpler pages)
    let extraction = {
      vendor: null as string | null,
      amount_cents: null as number | null,
      iban: null as string | null,
      reference: null as string | null,
      due_date: null as string | null,
      category_hint: 'overig',
      description: null as string | null,
    };

    if (fetchSucceeded && htmlContent.length > 100) {
      // Try meta tags first (most reliable on SPAs)
      const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
      const ogTitle = htmlContent.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      const ogDesc = htmlContent.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);

      // Look for embedded JSON data (Next.js __NEXT_DATA__, SPA state, etc.)
      const nextDataMatch = htmlContent.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
      const jsonLdMatch = htmlContent.match(/<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/i);

      // Try embedded data first
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const props = nextData?.props?.pageProps;
          if (props) {
            extraction.vendor = props.creditorName || props.vendor || props.company || null;
            if (props.amount) extraction.amount_cents = Math.round(parseFloat(String(props.amount)) * 100);
            extraction.iban = props.iban || null;
            extraction.reference = props.reference || props.paymentReference || null;
          }
        } catch { /* invalid JSON */ }
      }

      if (jsonLdMatch) {
        try {
          const ld = JSON.parse(jsonLdMatch[1]);
          if (ld.name) extraction.vendor = ld.name;
          if (ld.totalPaymentDue?.value) extraction.amount_cents = Math.round(parseFloat(ld.totalPaymentDue.value) * 100);
        } catch { /* invalid JSON */ }
      }

      // Fallback: regex on page text
      if (!extraction.vendor && ogTitle) extraction.vendor = ogTitle[1];
      if (!extraction.vendor && titleMatch) {
        const title = titleMatch[1].trim();
        if (title && !title.toLowerCase().includes('factuur') && title.length < 60) {
          extraction.vendor = title;
        }
      }

      // Strip HTML for regex extraction
      let text = htmlContent;
      text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
      text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
      text = text.replace(/<[^>]+>/g, ' ');
      text = text.replace(/&euro;/g, '€').replace(/&nbsp;/g, ' ');
      text = text.replace(/\s+/g, ' ').trim();

      // IBAN
      if (!extraction.iban) {
        const ibanMatch = text.match(/\b(NL\d{2}\s?[A-Z]{4}\s?\d{4}\s?\d{4}\s?\d{2})\b/i);
        if (ibanMatch) extraction.iban = ibanMatch[1].replace(/\s/g, '');
      }

      // Amount
      if (!extraction.amount_cents) {
        const amountMatch = text.match(/[€]\s?(\d{1,6}[.,]\d{2})/);
        if (amountMatch) {
          const numStr = amountMatch[1].replace('.', '').replace(',', '.');
          extraction.amount_cents = Math.round(parseFloat(numStr) * 100);
        }
      }

      // Reference
      if (!extraction.reference) {
        const refMatch = text.match(/(?:kenmerk|referentie|factuurnummer|betalingskenmerk)[:\s]+([A-Z0-9\-\.\/]{4,30})/i);
        if (refMatch) extraction.reference = refMatch[1].trim();
      }

      // Due date
      if (!extraction.due_date) {
        // Try DD-MM-YYYY or DD/MM/YYYY patterns near "vervaldatum" or "betaal voor"
        const dateContext = text.match(/(?:vervaldatum|betaal\s?voor|uiterlijk)[:\s]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
        if (dateContext) {
          extraction.due_date = `${dateContext[3]}-${dateContext[2].padStart(2, '0')}-${dateContext[1].padStart(2, '0')}`;
        }
      }
    }

    // Determine if we got useful data
    // Require at least vendor AND amount to count as useful data
    const hasData = !!(extraction.vendor && extraction.amount_cents);

    return NextResponse.json({
      extraction,
      payment_url: finalUrl,
      source_url: url,
      has_data: hasData,
      needs_photo: !hasData, // Signal to frontend: suggest photo scan
    }, { headers: NO_CACHE });

  } catch (err) {
    console.error('QR URL scan error:', err);
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500, headers: NO_CACHE });
  }
}
