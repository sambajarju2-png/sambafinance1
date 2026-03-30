/**
 * PayWatch Regex Extraction Engine
 *
 * Deterministic extraction of bill data from plain text.
 * No AI, no LLM calls. Uses regex, checksums, and lookup tables.
 *
 * Usage:
 *   import { extractFromText } from '@/lib/regex-extractor';
 *   const result = extractFromText(plainText, senderDomain);
 *
 * SERVER-ONLY — never import in client components.
 */

// ============================================================
// TYPES
// ============================================================

export interface RegexExtractionResult {
  vendor: string | null;
  amount_cents: number | null;
  iban: string | null;
  reference: string | null;
  due_date: string | null; // YYYY-MM-DD
  payment_url: string | null;
  method: 'regex'; // always 'regex' so we can track accuracy
  fields_found: string[]; // which fields were extracted
  confidence: number; // 0-1, based on how many fields we found
}

// ============================================================
// 1. IBAN EXTRACTION + MOD-97 VALIDATION
// ============================================================

const IBAN_REGEX = /\b([A-Z]{2}\d{2}\s?[A-Z]{4}\s?\d{4}\s?\d{4}\s?\d{2})\b/g;
const IBAN_STRICT = /\b([A-Z]{2}\d{2}[A-Z]{4}\d{10})\b/g;

/**
 * MOD-97 checksum validation (ISO 13616)
 * Guarantees the IBAN is mathematically valid, not just pattern-matched.
 */
function validateIbanMod97(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;

  // Move first 4 chars to end
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);

  // Convert letters to numbers (A=10, B=11, ... Z=35)
  let numStr = '';
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numStr += (code - 55).toString();
    } else {
      numStr += char;
    }
  }

  // MOD 97 on the large number (process in chunks to avoid BigInt issues)
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numStr[i])) % 97;
  }

  return remainder === 1;
}

/**
 * Extract and validate IBANs from text.
 * Returns the first valid IBAN found (prefers "betaal" context).
 */
export function extractIban(text: string): string | null {
  const upperText = text.toUpperCase().replace(/\s+/g, ' ');

  // First try: look for IBAN near payment-related keywords
  const paymentKeywords = [
    'BETAALINFORMATIE', 'OVERMAKEN NAAR', 'BETALEN AAN', 'IBAN', 'REKENINGNUMMER',
    'BANKREKENING', 'TE BETALEN OP', 'NAAR REKENING',
  ];

  for (const keyword of paymentKeywords) {
    const idx = upperText.indexOf(keyword);
    if (idx === -1) continue;

    // Search in a window around the keyword
    const window = upperText.slice(Math.max(0, idx - 20), idx + 200);
    const matches = window.match(IBAN_REGEX);
    if (matches) {
      for (const raw of matches) {
        const cleaned = raw.replace(/\s/g, '');
        if (validateIbanMod97(cleaned)) return cleaned;
      }
    }
  }

  // Fallback: find any valid IBAN in the text
  const allMatches = upperText.replace(/\s(?=[A-Z\d])/g, '').match(IBAN_STRICT) || [];
  for (const raw of allMatches) {
    if (validateIbanMod97(raw)) return raw;
  }

  // Relaxed: with spaces
  const spacedMatches = upperText.match(IBAN_REGEX) || [];
  for (const raw of spacedMatches) {
    const cleaned = raw.replace(/\s/g, '');
    if (validateIbanMod97(cleaned)) return cleaned;
  }

  return null;
}

// ============================================================
// 2. AMOUNT EXTRACTION (Dutch format)
// ============================================================

/**
 * Parse Dutch currency format to cents.
 * € 1.234,56 → 123456
 * € 127,43 → 12743
 * € 15,- → 1500
 * € 15 → 1500
 */
function parseDutchAmount(raw: string): number | null {
  let cleaned = raw
    .replace(/€|EUR/gi, '')
    .replace(/\s/g, '')
    .trim();

  // Handle "15,-" format
  cleaned = cleaned.replace(/,-$/, ',00');

  // Remove thousands separators (dots)
  // Dutch: 1.234,56 → remove dots, replace comma with dot
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes('.')) {
    // Ambiguous: could be "1.234" (thousands) or "12.34" (decimal)
    // If exactly 2 digits after dot → treat as decimal
    const parts = cleaned.split('.');
    if (parts[1]?.length === 2) {
      // 12.34 → keep as is (decimal)
    } else {
      // 1.234 → thousands separator, no decimals
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0 || num > 999999) return null;

  return Math.round(num * 100);
}

/**
 * Extract the "te betalen" amount from text.
 * Prioritizes "totaal te betalen" > "te betalen" > any € amount.
 */
export function extractAmount(text: string): number | null {
  const lines = text.split('\n').map((l) => l.trim());

  // Priority 1: "Totaal te betalen" or "Te betalen" on the same line as amount
  const priorityPatterns = [
    /(?:totaal\s+)?te\s+betalen[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /(?:totaal|total|bedrag)[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /openstaand\s*(?:bedrag|saldo)[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
  ];

  for (const pattern of priorityPatterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const cents = parseDutchAmount(match[1]);
        if (cents && cents > 0) return cents;
      }
    }
  }

  // Priority 2: € followed by amount anywhere
  const amountRegex = /(?:€|EUR)\s?([\d]{1,6}[.,][\d]{2}[-]?)/g;
  const amounts: number[] = [];

  for (const line of lines) {
    let match;
    while ((match = amountRegex.exec(line)) !== null) {
      const cents = parseDutchAmount(match[1]);
      if (cents && cents > 0) amounts.push(cents);
    }
  }

  // Return the largest amount found (usually the total)
  if (amounts.length > 0) {
    return Math.max(...amounts);
  }

  // Priority 3: bare number patterns like "127,43"
  const bareAmount = /\b(\d{1,6},\d{2})\b/g;
  const bareAmounts: number[] = [];
  let bareMatch;
  while ((bareMatch = bareAmount.exec(text)) !== null) {
    const cents = parseDutchAmount(bareMatch[1]);
    if (cents && cents >= 100) bareAmounts.push(cents); // at least €1
  }

  if (bareAmounts.length > 0) {
    return Math.max(...bareAmounts);
  }

  return null;
}

// ============================================================
// 3. DATE EXTRACTION
// ============================================================

const DUTCH_MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maart: '03', april: '04',
  mei: '05', juni: '06', juli: '07', augustus: '08',
  september: '09', oktober: '10', november: '11', december: '12',
  jan: '01', feb: '02', mrt: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dec: '12',
};

/**
 * Parse a date string to YYYY-MM-DD format.
 */
function parseDate(raw: string): string | null {
  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }

  // "15 januari 2026" or "15 jan 2026"
  const dutchDate = raw.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|okt|nov|dec)\s+(\d{4})/i);
  if (dutchDate) {
    const [, d, monthStr, y] = dutchDate;
    const m = DUTCH_MONTHS[monthStr.toLowerCase()];
    if (m) {
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  // YYYY-MM-DD (already ISO)
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  return null;
}

/**
 * Extract the due date from text.
 * Prioritizes "vervaldatum" > "betaal voor" > "uiterlijk" > any future date.
 */
export function extractDueDate(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim());

  // Priority keywords for due date
  const dueDateKeywords = [
    'vervaldatum', 'betaal voor', 'uiterlijk', 'voor', 'deadline',
    'betaaldatum', 'uiterste betaaldatum', 'vóór',
  ];

  for (const keyword of dueDateKeywords) {
    for (const line of lines) {
      if (line.toLowerCase().includes(keyword)) {
        const date = parseDate(line);
        if (date) return date;
      }
    }
  }

  // Fallback: find any date in the text that's in the future (or recent past)
  const allDateRegex = /\d{1,2}[-/]\d{1,2}[-/]\d{4}/g;
  const dates: string[] = [];
  let match;
  while ((match = allDateRegex.exec(text)) !== null) {
    const parsed = parseDate(match[0]);
    if (parsed) dates.push(parsed);
  }

  // Return the latest date (most likely the due date)
  if (dates.length > 0) {
    dates.sort();
    return dates[dates.length - 1];
  }

  return null;
}

// ============================================================
// 4. REFERENCE NUMBER EXTRACTION
// ============================================================

/**
 * Extract payment reference (betalingskenmerk, factuurnummer, dossiernummer).
 */
export function extractReference(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim());

  // Priority order: betalingskenmerk > kenmerk > dossiernummer > factuurnummer
  const refPatterns = [
    { regex: /betalingskenmerk[:\s]*([\w\d\s-]+)/i, priority: 1 },
    { regex: /kenmerk[:\s]*([\w\d\s-]+)/i, priority: 2 },
    { regex: /dossiernummer[:\s]*([\w\d-]+)/i, priority: 3 },
    { regex: /factuurnummer[:\s]*([\w\d-]+)/i, priority: 4 },
    { regex: /referentie(?:nummer)?[:\s]*([\w\d-]+)/i, priority: 5 },
    { regex: /ons\s*kenmerk[:\s]*([\w\d\s-]+)/i, priority: 6 },
  ];

  let bestMatch: { value: string; priority: number } | null = null;

  for (const line of lines) {
    for (const { regex, priority } of refPatterns) {
      const match = line.match(regex);
      if (match && match[1]) {
        const value = match[1].trim().slice(0, 50); // cap at 50 chars
        if (value.length >= 3 && (!bestMatch || priority < bestMatch.priority)) {
          bestMatch = { value, priority };
        }
      }
    }
  }

  return bestMatch?.value || null;
}

// ============================================================
// 5. PAYMENT URL EXTRACTION
// ============================================================

/**
 * Extract payment URLs from text.
 */
export function extractPaymentUrl(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const urls = text.match(urlRegex) || [];

  // Prioritize URLs with payment-related paths
  const paymentKeywords = ['betaal', 'pay', 'invoice', 'factuur', 'betaling', 'ideal', 'checkout'];

  for (const url of urls) {
    const lower = url.toLowerCase();
    if (paymentKeywords.some((kw) => lower.includes(kw))) {
      return url.replace(/[.,;)]+$/, ''); // strip trailing punctuation
    }
  }

  // Return first non-trivial URL as fallback
  for (const url of urls) {
    const cleaned = url.replace(/[.,;)]+$/, '');
    if (cleaned.length > 20 && !cleaned.includes('unsubscribe') && !cleaned.includes('afmelden')) {
      return cleaned;
    }
  }

  return null;
}

// ============================================================
// 6. VENDOR EXTRACTION (from text, not domain)
// ============================================================

/**
 * Extract vendor name from document text.
 * Looks for common patterns like company names near the top.
 */
export function extractVendorFromText(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Look for patterns like "Afzender:", "Van:", company name formats
  const vendorPatterns = [
    /(?:afzender|van|from|bedrijf|naam)[:\s]+(.+)/i,
    /(?:namens|opdrachtgever)[:\s]+(.+)/i,
  ];

  for (const line of lines.slice(0, 15)) { // check first 15 lines
    for (const pattern of vendorPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length >= 2 && name.length <= 80) return name;
      }
    }
  }

  // Look for B.V., N.V., Stichting patterns in first 10 lines
  for (const line of lines.slice(0, 10)) {
    if (/\b(B\.?V\.?|N\.?V\.?|Stichting|Gemeente|Coöperatie)\b/i.test(line)) {
      const cleaned = line.replace(/^[^a-zA-Z]+/, '').trim();
      if (cleaned.length >= 3 && cleaned.length <= 80) return cleaned;
    }
  }

  return null;
}

// ============================================================
// 7. VENDOR FROM EMAIL DOMAIN (Lookup Table)
// ============================================================

/**
 * Known Dutch vendor domains → display name mapping.
 * Expand this over time as you see more senders.
 */
const DOMAIN_VENDOR_MAP: Record<string, string> = {
  // Telecom
  'kpn.com': 'KPN',
  'info.nl.kpn.com': 'KPN',
  'ziggo.nl': 'Ziggo',
  'vodafoneziggo.nl': 'VodafoneZiggo',
  'odido.nl': 'Odido',
  'tele2.nl': 'Tele2',
  // Energy
  'vattenfall.nl': 'Vattenfall',
  'vattenfall.com': 'Vattenfall',
  'eneco.nl': 'Eneco',
  'essent.nl': 'Essent',
  'greenchoice.nl': 'Greenchoice',
  'budgetenergie.nl': 'Budget Energie',
  'engie.nl': 'ENGIE',
  // Water
  'waternet.nl': 'Waternet',
  'evides.nl': 'Evides',
  'vitens.nl': 'Vitens',
  'dunea.nl': 'Dunea',
  'brabantwater.nl': 'Brabant Water',
  // Insurance
  'zilverenkruis.nl': 'Zilveren Kruis',
  'cz.nl': 'CZ',
  'menzis.nl': 'Menzis',
  'vgz.nl': 'VGZ',
  'ohra.nl': 'OHRA',
  'interpolis.nl': 'Interpolis',
  'centraal-beheer.nl': 'Centraal Beheer',
  // Government
  'belastingdienst.nl': 'Belastingdienst',
  'cjib.nl': 'CJIB',
  'noreply.cjib.nl': 'CJIB',
  'duo.nl': 'DUO',
  'svb.nl': 'SVB',
  'cak.nl': 'CAK',
  'uwv.nl': 'UWV',
  // Housing
  'vestia.nl': 'Vestia',
  'woonstad.nl': 'Woonstad Rotterdam',
  'havensteder.nl': 'Havensteder',
  'woonbron.nl': 'Woonbron',
  // BNPL
  'klarna.com': 'Klarna',
  'afterpay.nl': 'Afterpay',
  'billink.nl': 'Billink',
  'riverty.com': 'Riverty',
  // Other
  'bol.com': 'Bol.com',
  'coolblue.nl': 'Coolblue',
  'ns.nl': 'NS',
  'translink.nl': 'OV-chipkaart',
};

/**
 * Look up vendor from email sender domain.
 */
export function lookupVendorByDomain(senderEmail: string): string | null {
  if (!senderEmail) return null;

  const domain = senderEmail.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  // Exact match
  if (DOMAIN_VENDOR_MAP[domain]) return DOMAIN_VENDOR_MAP[domain];

  // Try parent domain (e.g. info.nl.kpn.com → kpn.com)
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (DOMAIN_VENDOR_MAP[parent]) return DOMAIN_VENDOR_MAP[parent];
  }

  return null;
}

// ============================================================
// 8. MAIN EXTRACTION FUNCTION
// ============================================================

/**
 * Extract all bill fields from plain text using regex only.
 * No AI calls, no LLM, fully deterministic.
 *
 * @param text - Plain text (from OCR, email body, or PDF)
 * @param senderEmail - Optional email sender for vendor lookup
 * @returns Extraction result with all found fields
 */
export function extractFromText(
  text: string,
  senderEmail?: string
): RegexExtractionResult {
  const fieldsFound: string[] = [];

  // 1. Vendor — domain lookup first, then text extraction
  let vendor = senderEmail ? lookupVendorByDomain(senderEmail) : null;
  if (vendor) {
    fieldsFound.push('vendor');
  } else {
    vendor = extractVendorFromText(text);
    if (vendor) fieldsFound.push('vendor');
  }

  // 2. IBAN — regex + MOD-97 validation
  const iban = extractIban(text);
  if (iban) fieldsFound.push('iban');

  // 3. Amount — Dutch format parsing
  const amount_cents = extractAmount(text);
  if (amount_cents) fieldsFound.push('amount');

  // 4. Due date
  const due_date = extractDueDate(text);
  if (due_date) fieldsFound.push('due_date');

  // 5. Reference number
  const reference = extractReference(text);
  if (reference) fieldsFound.push('reference');

  // 6. Payment URL
  const payment_url = extractPaymentUrl(text);
  if (payment_url) fieldsFound.push('payment_url');

  // Confidence = proportion of key fields found (vendor, amount, iban are key)
  const keyFields = ['vendor', 'amount', 'iban'];
  const keyFound = keyFields.filter((f) => fieldsFound.includes(f)).length;
  const confidence = keyFound / keyFields.length;

  return {
    vendor,
    amount_cents,
    iban,
    reference,
    due_date,
    payment_url,
    method: 'regex',
    fields_found: fieldsFound,
    confidence,
  };
}
