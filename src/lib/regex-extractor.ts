/**
 * PayWatch Deterministic Bill Extraction Engine
 *
 * Extracts structured payment data from Dutch bill text using regex,
 * checksums, and keyword scoring. NO AI calls.
 *
 * Architecture:
 * 1. Amount extraction (priority-anchored Dutch format patterns)
 * 2. IBAN extraction (with MOD-97 validation)
 * 3. Due date extraction (keyword-anchored Dutch date formats)
 * 4. Reference number extraction (priority-ordered Dutch patterns)
 * 5. Payment URL extraction
 * 6. Escalation stage detection (weighted keyword scoring)
 * 7. Confidence scoring per field
 *
 * File: src/lib/regex-extractor.ts (sambafinance1 repo)
 */

// ============================================================
// TYPES
// ============================================================

export interface RegexExtractionResult {
  amount_cents: number | null;
  amount_confidence: number;
  iban: string | null;
  iban_confidence: number;
  due_date: string | null; // YYYY-MM-DD
  due_date_confidence: number;
  reference: string | null;
  reference_confidence: number;
  escalation_stage: string | null;
  escalation_confidence: number;
  payment_url: string | null;
  vendor_hint: string | null; // extracted from "namens" patterns
  overall_confidence: number; // 0-1, average of all fields
  fields_extracted: string[]; // which fields regex found
  fields_missing: string[]; // which fields need AI
}

// ============================================================
// 1. AMOUNT EXTRACTION (Dutch format)
// ============================================================

/**
 * Priority-ordered amount patterns.
 * Anchored patterns (near keywords) are tried first.
 * Fallback: any euro amount in the document.
 */
const AMOUNT_PATTERNS_PRIORITY = [
  // "Te betalen" variants (highest priority — this is THE correct amount)
  /(?:totaal\s+)?te\s+betalen\s*[:=]?\s*(?:€|EUR|eur)\s?([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)/i,
  /(?:totaal\s+)?te\s+betalen\s*[:=]?\s*([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)\s*(?:€|EUR|euro)/i,
  // "Nog te betalen" (payment plans)
  /nog\s+te\s+betalen\s*[:=]?\s*(?:€|EUR)\s?([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)/i,
  // "Totaalbedrag"
  /totaalbedrag\s*[:=]?\s*(?:€|EUR)\s?([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)/i,
  // "Openstaand bedrag/saldo"
  /openstaand\s*(?:bedrag|saldo)\s*[:=]?\s*(?:€|EUR)\s?([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)/i,
  // "Verschuldigd bedrag"
  /verschuldigd\s*(?:bedrag)?\s*[:=]?\s*(?:€|EUR)\s?([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)/i,
  // "Totaal" (generic)
  /\btotaal\s*[:=]?\s*(?:€|EUR)\s?([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)/i,
  // "Bedrag" (generic)
  /\bbedrag\s*[:=]?\s*(?:€|EUR)\s?([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)/i,
];

// Fallback: any euro amount
const AMOUNT_FALLBACK = /(?:€|EUR)\s?([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)/g;

/**
 * Parse Dutch-formatted amount string to integer cents.
 * € 1.234,56 → 123456
 * € 127,43 → 12743
 * € 15,- → 1500
 * € 15 → 1500
 */
export function parseDutchAmount(amountStr: string): number {
  let cleaned = amountStr.trim().replace(/[-]+$/, ''); // remove trailing dash

  // Handle "15,-" format (dash means zero cents)
  const hasDash = amountStr.trim().endsWith('-') || amountStr.trim().endsWith(',-');

  // Remove thousands dots
  cleaned = cleaned.replace(/\./g, '');

  // Replace comma with dot for parsing
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    const euros = parseInt(parts[0], 10) || 0;
    const centStr = parts[1] || '0';
    const cents = centStr.length === 1
      ? parseInt(centStr, 10) * 10
      : parseInt(centStr.slice(0, 2), 10);
    return euros * 100 + cents;
  }

  // No comma — whole euros
  const euros = parseInt(cleaned, 10) || 0;
  if (hasDash) return euros * 100;
  return euros * 100;
}

export function extractAmount(text: string): { amount_cents: number | null; confidence: number } {
  // Try priority patterns first
  for (let i = 0; i < AMOUNT_PATTERNS_PRIORITY.length; i++) {
    const match = text.match(AMOUNT_PATTERNS_PRIORITY[i]);
    if (match && match[1]) {
      const cents = parseDutchAmount(match[1]);
      if (cents > 0 && cents < 100_000_00) { // sanity: max €100k
        // Higher confidence for earlier (more specific) patterns
        const conf = Math.max(0.6, 1.0 - i * 0.05);
        return { amount_cents: cents, confidence: conf };
      }
    }
  }

  // Fallback: collect all euro amounts, pick the largest reasonable one
  const amounts: number[] = [];
  let fallbackMatch;
  while ((fallbackMatch = AMOUNT_FALLBACK.exec(text)) !== null) {
    const cents = parseDutchAmount(fallbackMatch[1]);
    if (cents > 0 && cents < 100_000_00) {
      amounts.push(cents);
    }
  }

  if (amounts.length > 0) {
    // Pick the most common amount, or the largest if all unique
    const sorted = amounts.sort((a, b) => b - a);
    return { amount_cents: sorted[0], confidence: 0.4 };
  }

  return { amount_cents: null, confidence: 0 };
}

// ============================================================
// 2. IBAN EXTRACTION (with MOD-97 validation)
// ============================================================

const IBAN_PATTERN = /\b([A-Z]{2}\d{2}\s?[A-Z]{4}\s?\d{4}\s?\d{4}\s?\d{2})\b/g;
const IBAN_COMPACT = /\b([A-Z]{2}\d{2}[A-Z]{4}\d{10})\b/g;

// Keywords that indicate the PAYMENT IBAN (not the customer's own)
const IBAN_PRIORITY_KEYWORDS = [
  'betaalinformatie', 'overmaken naar', 'betalen op', 'rekeningnummer',
  'begunstigde', 'ten name van', 't.n.v.', 'iban', 'bankrekening',
  'betaal naar', 'storten op',
];

// Keywords that indicate the WRONG IBAN (customer's own account)
const IBAN_SKIP_KEYWORDS = [
  'uw rekening', 'uw iban', 'uw rekeningnummer', 'afgeschreven van',
  'geïncasseerd van', 'automatische incasso',
];

/**
 * MOD-97 IBAN validation.
 * Returns true if the IBAN checksum is valid.
 */
export function validateIbanMod97(iban: string): boolean {
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (clean.length < 15 || clean.length > 34) return false;

  // Move first 4 characters to end
  const rearranged = clean.slice(4) + clean.slice(0, 4);

  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  let numericStr = '';
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numericStr += (code - 55).toString();
    } else {
      numericStr += char;
    }
  }

  // Compute modulo 97 on the large number (process in chunks to avoid overflow)
  let remainder = 0;
  for (let i = 0; i < numericStr.length; i += 7) {
    const chunk = numericStr.slice(i, i + 7);
    remainder = parseInt(remainder.toString() + chunk, 10) % 97;
  }

  return remainder === 1;
}

export function extractIban(text: string): { iban: string | null; confidence: number } {
  const upperText = text.toUpperCase();

  // Collect all potential IBANs
  const candidates: Array<{ iban: string; score: number }> = [];
  const patterns = [IBAN_COMPACT, IBAN_PATTERN];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(upperText)) !== null) {
      const raw = match[1].replace(/\s/g, '');
      if (validateIbanMod97(raw)) {
        // Score based on proximity to priority keywords
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(upperText.length, match.index + 200);
        const context = upperText.slice(contextStart, contextEnd).toLowerCase();

        let score = 0.5;

        // Boost if near payment keywords
        if (IBAN_PRIORITY_KEYWORDS.some(kw => context.includes(kw))) {
          score = 0.9;
        }

        // Penalize if near "your own account" keywords
        if (IBAN_SKIP_KEYWORDS.some(kw => context.includes(kw))) {
          score = 0.1;
        }

        // Boost Dutch IBANs (NL prefix)
        if (raw.startsWith('NL')) score += 0.05;

        candidates.push({ iban: raw, score });
      }
    }
  }

  if (candidates.length === 0) return { iban: null, confidence: 0 };

  // Pick highest-scored IBAN
  candidates.sort((a, b) => b.score - a.score);
  return { iban: candidates[0].iban, confidence: Math.min(1, candidates[0].score) };
}

// ============================================================
// 3. DUE DATE EXTRACTION
// ============================================================

const DUTCH_MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
  jan: 1, feb: 2, mrt: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dec: 12,
};

const DUE_DATE_KEYWORDS = [
  'vervaldatum', 'uiterste betaaldatum', 'betaal voor', 'betalen voor',
  'uiterlijk', 'vóór', 'voor', 'uiterste datum', 'betaaltermijn',
];

// Avoid these — they're document dates, not due dates
const SKIP_DATE_KEYWORDS = [
  'factuurdatum', 'verzenddatum', 'briefdatum', 'datum:', 'aanmaakdatum',
];

const DATE_PATTERNS = [
  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  /(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})/,
  // DD maand YYYY ("15 januari 2026")
  /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i,
  // DD mmm YYYY ("15 jan 2026")
  /(\d{1,2})\s+(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)\.?\s+(\d{4})/i,
];

function parseDate(match: RegExpMatchArray, patternIndex: number): string | null {
  try {
    let day: number, month: number, year: number;

    if (patternIndex === 0) {
      day = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      year = parseInt(match[3], 10);
    } else {
      day = parseInt(match[1], 10);
      month = DUTCH_MONTHS[match[2].toLowerCase()] || 0;
      year = parseInt(match[3], 10);
    }

    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2020 || year > 2030) {
      return null;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

export function extractDueDate(text: string): { due_date: string | null; confidence: number } {
  const lines = text.split('\n');

  // Strategy 1: Find date on same line as a due date keyword
  for (const line of lines) {
    const lower = line.toLowerCase();

    // Skip document date lines
    if (SKIP_DATE_KEYWORDS.some(kw => lower.includes(kw))) continue;

    if (DUE_DATE_KEYWORDS.some(kw => lower.includes(kw))) {
      for (let pi = 0; pi < DATE_PATTERNS.length; pi++) {
        const match = line.match(DATE_PATTERNS[pi]);
        if (match) {
          const date = parseDate(match, pi);
          if (date) return { due_date: date, confidence: 0.9 };
        }
      }

      // Check next line too (date might be on the line below the keyword)
      const lineIdx = lines.indexOf(line);
      if (lineIdx >= 0 && lineIdx < lines.length - 1) {
        const nextLine = lines[lineIdx + 1];
        for (let pi = 0; pi < DATE_PATTERNS.length; pi++) {
          const match = nextLine.match(DATE_PATTERNS[pi]);
          if (match) {
            const date = parseDate(match, pi);
            if (date) return { due_date: date, confidence: 0.8 };
          }
        }
      }
    }
  }

  // Strategy 2: Find earliest future date in document
  const today = new Date().toISOString().split('T')[0];
  const futureDates: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (SKIP_DATE_KEYWORDS.some(kw => lower.includes(kw))) continue;

    for (let pi = 0; pi < DATE_PATTERNS.length; pi++) {
      const match = line.match(DATE_PATTERNS[pi]);
      if (match) {
        const date = parseDate(match, pi);
        if (date && date >= today) {
          futureDates.push(date);
        }
      }
    }
  }

  if (futureDates.length > 0) {
    futureDates.sort();
    return { due_date: futureDates[0], confidence: 0.5 };
  }

  return { due_date: null, confidence: 0 };
}

// ============================================================
// 4. REFERENCE NUMBER EXTRACTION
// ============================================================

const REFERENCE_PATTERNS = [
  { keyword: 'betalingskenmerk', pattern: /betalingskenmerk\s*[:=]?\s*([A-Z0-9\s\-]{6,30})/i, confidence: 0.95 },
  { keyword: 'betaalreferentie', pattern: /betaalreferentie\s*[:=]?\s*([A-Z0-9\s\-]{6,30})/i, confidence: 0.9 },
  { keyword: 'kenmerk', pattern: /(?:ons\s+)?kenmerk\s*[:=]?\s*([A-Z0-9\s\-]{4,30})/i, confidence: 0.85 },
  { keyword: 'dossiernummer', pattern: /dossiernummer\s*[:=]?\s*([A-Z0-9\s\-]{4,20})/i, confidence: 0.85 },
  { keyword: 'zaaknummer', pattern: /zaaknummer\s*[:=]?\s*([A-Z0-9\s\-]{4,20})/i, confidence: 0.8 },
  { keyword: 'factuurnummer', pattern: /factuurnr?\.?\s*[:=]?\s*([A-Z0-9\s\-]{4,20})/i, confidence: 0.75 },
  { keyword: 'referentienummer', pattern: /referentie(?:nummer)?\s*[:=]?\s*([A-Z0-9\s\-]{4,20})/i, confidence: 0.75 },
  { keyword: 'boete-/transactienummer', pattern: /(?:boete|transactie)(?:nummer)?\s*[:=]?\s*([A-Z0-9\s\-]{4,20})/i, confidence: 0.8 },
];

export function extractReference(text: string): { reference: string | null; confidence: number } {
  for (const { pattern, confidence } of REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const ref = match[1].trim().replace(/\s+/g, ' ');
      if (ref.length >= 4) {
        return { reference: ref, confidence };
      }
    }
  }
  return { reference: null, confidence: 0 };
}

// ============================================================
// 5. PAYMENT URL EXTRACTION
// ============================================================

const PAYMENT_URL_KEYWORDS = ['betaal', 'pay', 'invoice', 'factuur', 'ideal', 'tikkie', 'mollie'];
const SKIP_URL_KEYWORDS = ['unsubscribe', 'afmelden', 'privacy', 'cookie', 'uitschrijven'];

export function extractPaymentUrl(text: string): string | null {
  const urlPattern = /https?:\/\/[^\s<>"'\])+]+/g;
  let match;
  const candidates: Array<{ url: string; score: number }> = [];

  while ((match = urlPattern.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:!?)]+$/, ''); // strip trailing punctuation
    const lower = url.toLowerCase();

    if (SKIP_URL_KEYWORDS.some(kw => lower.includes(kw))) continue;

    let score = 0.3;
    if (PAYMENT_URL_KEYWORDS.some(kw => lower.includes(kw))) score = 0.9;

    candidates.push({ url, score });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}

// ============================================================
// 6. ESCALATION STAGE DETECTION (weighted keyword scoring)
// ============================================================

const ESCALATION_KEYWORDS: Record<string, { weight: number; keywords: string[] }> = {
  deurwaarder: {
    weight: 5,
    keywords: [
      'deurwaarder', 'gerechtsdeurwaarder', 'exploot', 'dagvaarding',
      'beslag', 'dwangbevel', 'vonnis', 'rechtbank', 'beslagvrije voet',
      'loonbeslag', 'executie', 'betekening', 'gerechtelijk',
    ],
  },
  incasso: {
    weight: 4,
    keywords: [
      'incasso', 'incassobureau', 'vordering', 'namens onze opdrachtgever',
      'buitengerechtelijke kosten', 'wettelijke rente', 'ingebrekestelling',
      'wik-kosten', 'uit handen gegeven', 'dossier overgedragen',
      'collection', 'in opdracht van', 'buitengerechtelijke',
    ],
  },
  aanmaning: {
    weight: 3,
    keywords: [
      'aanmaning', 'laatste waarschuwing', 'sommatie', 'wanbetaling',
      'in gebreke', 'verzuim', 'onbetaald gebleven', '2e herinnering',
      'tweede herinnering', 'wij sommeren',
    ],
  },
  herinnering: {
    weight: 2,
    keywords: [
      'herinnering', 'betalingsherinnering', 'reminder', '1e herinnering',
      'eerste herinnering', 'nog niet ontvangen', 'vriendelijk verzoek',
    ],
  },
  factuur: {
    weight: 1,
    keywords: [
      'factuur', 'nota', 'rekening', 'invoice', 'termijnbedrag',
      'voorschotnota', 'maandbedrag',
    ],
  },
};

export function detectEscalationStage(text: string): { stage: string; confidence: number } {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [stage, { weight, keywords }] of Object.entries(ESCALATION_KEYWORDS)) {
    let count = 0;
    for (const kw of keywords) {
      // Count occurrences
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = lower.match(regex);
      if (matches) count += matches.length;
    }
    scores[stage] = count * weight;
  }

  // Find highest score
  const sorted = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) {
    return { stage: 'factuur', confidence: 0.3 };
  }

  const [topStage, topScore] = sorted[0];
  const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);
  const confidence = Math.min(1, topScore / Math.max(totalScore, 1) * 0.8 + 0.2);

  return { stage: topStage, confidence };
}

// ============================================================
// 7. VENDOR HINT EXTRACTION (from "namens" patterns)
// ============================================================

export function extractVendorHint(text: string): string | null {
  const patterns = [
    /namens\s+(?:onze\s+)?(?:opdrachtgever\s+)?[:\s]*([A-Z][A-Za-z\s&.]+?)(?:\s*[,(]|\s*\n)/,
    /in\s+opdracht\s+van\s+[:\s]*([A-Z][A-Za-z\s&.]+?)(?:\s*[,(]|\s*\n)/,
    /opdrachtgever\s*[:=]\s*([A-Z][A-Za-z\s&.]+?)(?:\s*[,(]|\s*\n)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length >= 2 && name.length <= 60) return name;
    }
  }

  return null;
}

// ============================================================
// MAIN: EXTRACT ALL FIELDS
// ============================================================

/**
 * Run the full deterministic extraction pipeline on raw text.
 * Returns extracted fields with per-field confidence scores.
 * Fields with confidence < threshold should be sent to AI.
 */
export function regexExtract(text: string): RegexExtractionResult {
  const amount = extractAmount(text);
  const iban = extractIban(text);
  const dueDate = extractDueDate(text);
  const reference = extractReference(text);
  const escalation = detectEscalationStage(text);
  const paymentUrl = extractPaymentUrl(text);
  const vendorHint = extractVendorHint(text);

  const fieldsExtracted: string[] = [];
  const fieldsMissing: string[] = [];

  if (amount.amount_cents) fieldsExtracted.push('amount');
  else fieldsMissing.push('amount');

  if (iban.iban) fieldsExtracted.push('iban');
  else fieldsMissing.push('iban');

  if (dueDate.due_date) fieldsExtracted.push('due_date');
  else fieldsMissing.push('due_date');

  if (reference.reference) fieldsExtracted.push('reference');
  else fieldsMissing.push('reference');

  if (escalation.stage !== 'factuur' || escalation.confidence > 0.5) {
    fieldsExtracted.push('escalation_stage');
  } else {
    fieldsMissing.push('escalation_stage');
  }

  if (paymentUrl) fieldsExtracted.push('payment_url');

  // Calculate overall confidence
  const confidences = [
    amount.confidence,
    iban.confidence,
    dueDate.confidence,
    reference.confidence,
    escalation.confidence,
  ];
  const overall = confidences.reduce((a, b) => a + b, 0) / confidences.length;

  return {
    amount_cents: amount.amount_cents,
    amount_confidence: amount.confidence,
    iban: iban.iban,
    iban_confidence: iban.confidence,
    due_date: dueDate.due_date,
    due_date_confidence: dueDate.confidence,
    reference: reference.reference,
    reference_confidence: reference.confidence,
    escalation_stage: escalation.stage,
    escalation_confidence: escalation.confidence,
    payment_url: paymentUrl,
    vendor_hint: vendorHint,
    overall_confidence: Math.round(overall * 100) / 100,
    fields_extracted: fieldsExtracted,
    fields_missing: fieldsMissing,
  };
}

/**
 * Determine if AI is needed based on extraction results.
 * Returns true if critical fields are missing or low-confidence.
 */
export function needsAiFallback(result: RegexExtractionResult): boolean {
  // If amount is missing, we NEED AI
  if (!result.amount_cents) return true;

  // If amount confidence is very low, verify with AI
  if (result.amount_confidence < 0.5) return true;

  // If overall confidence is too low
  if (result.overall_confidence < 0.4) return true;

  return false;
}
