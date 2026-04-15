/**
 * PayWatch Regex Extraction Engine v4 — Multi-AI Optimized
 *
 * Merged improvements from Claude, Gemini, and ChatGPT analysis:
 * - IBAN OCR fuzzy repair (character substitution + MOD-97 re-validation)
 * - Amount sum validation (A + B = C → C is total)
 * - Relative date calculation ("binnen 14 dagen")
 * - Soft escalation keywords (sociale incasso, storno)
 * - BTW-id + KVK extraction for vendor identification
 * - Secondary vendor detection ("namens", "opdrachtgever")
 * - Proximity-scored amount extraction
 *
 * DB-powered: vendor_category_map (454) + incasso_agencies (270) + vendor_corrections
 * SERVER-ONLY
 */

import { createServiceRoleClient } from '@/lib/supabase/server';

// ============================================================
// TYPES
// ============================================================

export interface RegexExtractionResult {
  vendor: string | null;
  secondary_vendor: string | null; // "namens [opdrachtgever]"
  amount_cents: number | null;
  iban: string | null;
  reference: string | null;
  due_date: string | null;
  payment_url: string | null;
  escalation_stage: string | null;
  category_hint: string;
  is_incasso: boolean;
  kvk_number: string | null;
  btw_id: string | null;
  method: 'regex';
  fields_found: string[];
  confidence: number;
  match_sources: string[];
}

// ============================================================
// 1. IBAN — REGEX + MOD-97 + OCR REPAIR
// ============================================================

const IBAN_REGEX = /\b([A-Z]{2}\d{2}\s?[A-Z]{4}\s?\d{4}\s?\d{4}\s?\d{2})\b/g;
const IBAN_STRICT = /\b([A-Z]{2}\d{2}[A-Z]{4}\d{10})\b/g;

function validateIbanMod97(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  let numStr = '';
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    numStr += code >= 65 && code <= 90 ? (code - 55).toString() : char;
  }
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numStr[i])) % 97;
  }
  return remainder === 1;
}

/** OCR confusion map — try these substitutions when MOD-97 fails */
const OCR_CONFUSIONS: Record<string, string[]> = {
  '0': ['O', 'D'], 'O': ['0'], 'D': ['0'],
  '1': ['I', 'l'], 'I': ['1'], 'l': ['1'],
  '5': ['S'], 'S': ['5'],
  '8': ['B'], 'B': ['8'],
  '2': ['Z'], 'Z': ['2'],
};

function repairIban(raw: string): string | null {
  const cleaned = raw.replace(/\s/g, '').toUpperCase();
  if (validateIbanMod97(cleaned)) return cleaned;

  // Try single-character substitutions
  const chars = cleaned.split('');
  for (let i = 4; i < chars.length; i++) { // skip country+check digits
    const alternatives = OCR_CONFUSIONS[chars[i]] || [];
    for (const alt of alternatives) {
      const candidate = [...chars];
      candidate[i] = alt;
      const attempt = candidate.join('');
      if (validateIbanMod97(attempt)) return attempt;
    }
  }
  return null;
}

export function extractIban(text: string): string | null {
  const upperText = text.toUpperCase();
  const paymentKeywords = [
    'BETAALINFORMATIE', 'OVERMAKEN NAAR', 'BETALEN AAN', 'IBAN',
    'REKENINGNUMMER', 'BANKREKENING', 'CREDITEUR', 'BEGUNSTIGDE',
    'DERDENGELDEN', // incasso trust accounts
  ];

  // Priority: near payment keywords
  for (const keyword of paymentKeywords) {
    const idx = upperText.indexOf(keyword);
    if (idx === -1) continue;
    const window = upperText.slice(idx, idx + 250);
    const matches = [
      ...(window.match(IBAN_STRICT) || []),
      ...(window.match(IBAN_REGEX) || []).map((m) => m.replace(/\s/g, '')),
    ];
    for (const raw of matches) {
      const valid = repairIban(raw);
      if (valid) return valid;
    }
  }

  // Fallback: any valid IBAN
  const all = [
    ...(upperText.match(IBAN_STRICT) || []),
    ...(upperText.match(IBAN_REGEX) || []).map((m) => m.replace(/\s/g, '')),
  ];
  for (const raw of Array.from(new Set(all))) {
    const valid = repairIban(raw);
    if (valid) return valid;
  }
  return null;
}

// ============================================================
// 2. AMOUNT — ANCHOR SCORING + SUM VALIDATION
// ============================================================

function parseDutchAmount(raw: string): number | null {
  let cleaned = raw.replace(/€|EUR/gi, '').replace(/\s/g, '').trim();
  cleaned = cleaned.replace(/,-$/, ',00').replace(/-$/, '');
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts[1]?.length !== 2) cleaned = cleaned.replace(/\./g, '');
  }
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0 || num > 999999) return null;
  return Math.round(num * 100);
}

interface ScoredAmount { cents: number; score: number; line: string }

export function extractAmount(text: string): number | null {
  const lines = text.split('\n').map((l) => l.trim());
  const scored: ScoredAmount[] = [];

  const amountRegex = /(?:€|EUR)\s?([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)/g;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lower = line.toLowerCase();
    let match;

    while ((match = amountRegex.exec(line)) !== null) {
      const cents = parseDutchAmount(match[1]);
      if (!cents || cents < 50) continue;

      let score = 0;

      // Anchor scoring (proximity to keywords)
      if (/totaal\s+te\s+betalen|nog\s+te\s+betalen/i.test(lower)) score += 15;
      else if (/totaal(?:bedrag)?|total/i.test(lower)) score += 12;
      else if (/te\s+betalen|verschuldigd|openstaand/i.test(lower)) score += 10;
      else if (/factuurbedrag|hoofdsom/i.test(lower)) score += 8;

      // Exclusion scoring
      if (/btw|subtotaal|exclusief|korting|credit/i.test(lower)) score -= 20;
      if (/vorig\s+(openstaand|saldo)/i.test(lower)) score -= 10;

      // Bottom-of-page bias (Dutch bills put total near the end)
      const positionBonus = Math.floor((lineIdx / lines.length) * 5);
      score += positionBonus;

      scored.push({ cents, score, line });
    }
  }

  if (scored.length === 0) {
    // Try bare amounts (no € symbol)
    const bare = /\b(\d{1,6},\d{2})\b/g;
    let bm;
    while ((bm = bare.exec(text)) !== null) {
      const cents = parseDutchAmount(bm[1]);
      if (cents && cents >= 500) scored.push({ cents, score: 0, line: '' });
    }
  }

  if (scored.length === 0) return null;

  // Sum validation: if A + B = C, C is the total (high confidence)
  const allCents = scored.map((s) => s.cents);
  for (const a of allCents) {
    for (const b of allCents) {
      if (a === b) continue;
      const sum = a + b;
      if (allCents.includes(sum)) {
        return sum; // A + B = C → C is total
      }
    }
  }

  // Otherwise pick highest-scored amount
  scored.sort((a, b) => b.score - a.score);
  return scored[0].cents;
}

// ============================================================
// 3. DATE — ABSOLUTE + RELATIVE ("binnen 14 dagen")
// ============================================================

const DUTCH_MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maart: '03', april: '04', mei: '05', juni: '06',
  juli: '07', augustus: '08', september: '09', oktober: '10', november: '11', december: '12',
  jan: '01', feb: '02', mrt: '03', apr: '04', jun: '06', jul: '07',
  aug: '08', sep: '09', okt: '10', nov: '11', dec: '12',
};

const DUTCH_NUMBER_WORDS: Record<string, number> = {
  vijf: 5, zeven: 7, acht: 8, tien: 10, veertien: 14, dertig: 30, negentig: 90,
};

function parseDate(raw: string): string | null {
  const dmy = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const mi = parseInt(m), di = parseInt(d), yi = parseInt(y);
    if (mi >= 1 && mi <= 12 && di >= 1 && di <= 31 && yi >= 2020 && yi <= 2030) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  const dutch = raw.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|okt|nov|dec)\.?\s+(\d{4})/i);
  if (dutch) {
    const [, d, monthStr, y] = dutch;
    const m = DUTCH_MONTHS[monthStr.toLowerCase().replace('.', '')];
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`;
  }
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return null;
}

/** Calculate relative dates like "binnen 14 dagen" from a base date */
function calculateRelativeDate(text: string, baseDate?: string): string | null {
  const patterns = [
    /binnen\s+(\d+)\s+dagen/i,
    /binnen\s+(vijf|zeven|acht|tien|veertien|dertig)\s+dagen/i,
    /termijn\s+van\s+(\d+)\s+dagen/i,
    /uiterlijk\s+over\s+(\d+)\s+dagen/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const daysStr = match[1].toLowerCase();
      const days = DUTCH_NUMBER_WORDS[daysStr] || parseInt(daysStr);
      if (isNaN(days)) continue;

      const base = baseDate ? new Date(baseDate) : new Date();
      base.setDate(base.getDate() + days);
      return base.toISOString().split('T')[0];
    }
  }
  return null;
}

/** Extract document/invoice date as base for relative calculations */
function extractDocumentDate(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim());
  const keywords = ['factuurdatum', 'datum', 'briefdatum', 'verzonden op'];
  for (const kw of keywords) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(kw)) {
        const date = parseDate(lines[i]) || (i < lines.length - 1 ? parseDate(lines[i + 1]) : null);
        if (date) return date;
      }
    }
  }
  return null;
}

export function extractDueDate(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim());
  const keywords = [
    'vervaldatum', 'uiterste betaaldatum', 'betaal voor', 'uiterlijk',
    'vóór', 'betaaldatum', 'te voldoen voor', 'te betalen voor',
  ];

  // Priority 1: absolute date near keyword
  for (const kw of keywords) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(kw)) {
        const date = parseDate(lines[i]) || (i < lines.length - 1 ? parseDate(lines[i + 1]) : null);
        if (date) return date;
      }
    }
  }

  // Priority 2: relative date ("binnen X dagen")
  const docDate = extractDocumentDate(text);
  const relative = calculateRelativeDate(text, docDate || undefined);
  if (relative) return relative;

  // Priority 3: earliest future date
  const allDates: string[] = [];
  const dateRegex = /\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/g;
  let match;
  while ((match = dateRegex.exec(text)) !== null) {
    const parsed = parseDate(match[0]);
    if (parsed) allDates.push(parsed);
  }
  const writtenRegex = /\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/gi;
  while ((match = writtenRegex.exec(text)) !== null) {
    const parsed = parseDate(match[0]);
    if (parsed) allDates.push(parsed);
  }

  if (allDates.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const future = allDates.filter((d) => d >= today).sort();
    return future[0] || allDates.sort().pop() || null;
  }
  return null;
}

// ============================================================
// 4. REFERENCE + PAYMENT URL
// ============================================================

export function extractReference(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim());
  const patterns = [
    { r: /betalingskenmerk[:\s]*([\w\d\s.-]+)/i, p: 1 },
    { r: /betaalreferentie[:\s]*([\w\d\s.-]+)/i, p: 1 },
    { r: /(?:ons\s+)?kenmerk[:\s]*([\w\d\s.-]+)/i, p: 2 },
    { r: /dossiernummer[:\s]*([\w\d.-]+)/i, p: 3 },
    { r: /factuurnummer[:\s]*([\w\d.-]+)/i, p: 4 },
    { r: /studentnummer[:\s]*([\w\d.-]+)/i, p: 4 }, // education
    { r: /referentie(?:nummer)?[:\s]*([\w\d.-]+)/i, p: 5 },
    { r: /factuur(?:nr)?\.?[:\s]*([\w\d.-]+)/i, p: 6 },
    { r: /zaak(?:nummer)?[:\s]*([\w\d.-]+)/i, p: 7 },
    { r: /polisnummer[:\s]*([\w\d.-]+)/i, p: 7 }, // insurance
  ];
  let best: { v: string; p: number } | null = null;
  for (const line of lines) {
    for (const { r, p } of patterns) {
      const m = line.match(r);
      if (m?.[1]) {
        const v = m[1].trim().slice(0, 50);
        if (v.length >= 3 && (!best || p < best.p)) best = { v, p };
      }
    }
  }
  return best?.v || null;
}

export function extractPaymentUrl(text: string): string | null {
  const urls = text.match(/https?:\/\/[^\s<>"'\])+]+/g) || [];
  const pay = ['betaal', 'pay', 'invoice', 'factuur', 'ideal', 'tikkie', 'mollie', 'buckaroo'];
  const skip = ['unsubscribe', 'afmelden', 'uitschrijven', 'privacy', 'cookie', 'mailto'];
  for (const url of urls) {
    const l = url.toLowerCase();
    if (skip.some((s) => l.includes(s))) continue;
    if (pay.some((k) => l.includes(k))) return url.replace(/[.,;)]+$/, '');
  }
  for (const url of urls) {
    const cleaned = url.replace(/[.,;)]+$/, '');
    if (cleaned.length > 25 && !skip.some((s) => url.toLowerCase().includes(s))) return cleaned;
  }
  return null;
}

// ============================================================
// 5. ESCALATION — EXPANDED WITH SOFT INCASSO + STORNO
// ============================================================

const ESCALATION_KEYWORDS: { stage: string; keywords: string[]; weight: number }[] = [
  { stage: 'deurwaarder', keywords: [
    'deurwaarder', 'gerechtsdeurwaarder', 'exploot', 'dagvaarding', 'beslag',
    'executoriaal', 'dwangbevel', 'vonnis', 'rechtbank', 'beslagvrije voet',
    'loonbeslag', 'ambtelijk schrijven', 'betekening', 'ontruiming', 'rechter',
  ], weight: 5 },
  { stage: 'incasso', keywords: [
    'incasso', 'incassobureau', 'vordering', 'namens onze opdrachtgever',
    'buitengerechtelijke kosten', 'buitengerechtelijke incassokosten',
    'wettelijke rente', 'ingebrekestelling', 'wik-kosten', 'overdracht aan',
    // Soft incasso (sociale incasso)
    'voorkom extra kosten', 'achterstand', 'niet tijdig voldaan',
    'hulp bij schulden', 'openstaande vordering', 'boven op uw openstaande',
  ], weight: 4 },
  { stage: 'aanmaning', keywords: [
    'aanmaning', 'laatste waarschuwing', 'sommatie', 'dringend verzoek',
    'wanbetaling', 'in gebreke', 'verzuim', 'onbetaald gebleven',
    'tweede herinnering', '2e herinnering', 'finale herinnering',
    // Storno
    'gestorneerd', 'storno', 'niet gelukt', 'over te maken',
    'mislukte incasso', 'automatische incasso mislukt',
  ], weight: 3 },
  { stage: 'herinnering', keywords: [
    'herinnering', 'betalingsherinnering', 'reminder', 'eerste herinnering',
    '1e herinnering', 'nog niet ontvangen', 'vriendelijk verzoek',
    'vergeten te betalen', 'herhaald verzoek',
  ], weight: 2 },
  { stage: 'factuur', keywords: [
    'factuur', 'nota', 'rekening', 'invoice', 'termijnbedrag',
    'maandbedrag', 'voorschotnota', 'jaarnota', 'energienota',
  ], weight: 1 },
];

export function detectEscalationStage(text: string): string | null {
  const lower = text.toLowerCase();
  let bestStage: string | null = null;
  let bestWeight = 0;
  let bestCount = 0;

  for (const { stage, keywords, weight } of ESCALATION_KEYWORDS) {
    let count = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) count++;
    }
    if (count > 0 && (weight > bestWeight || (weight === bestWeight && count > bestCount))) {
      bestStage = stage;
      bestWeight = weight;
      bestCount = count;
    }
  }
  return bestStage;
}

// ============================================================
// 6. KVK + BTW-ID EXTRACTION
// ============================================================

export function extractKvkNumber(text: string): string | null {
  const patterns = [
    /(?:KvK|KVK|Kamer\s+van\s+Koophandel|Handelsregister)[:\s-]*(\d{8})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

export function extractBtwId(text: string): string | null {
  const m = text.match(/\bNL\d{9}B\d{2}\b/);
  return m ? m[0] : null;
}

// ============================================================
// 7. VENDOR EXTRACTION
// ============================================================

// 7a. Domain map (hardcoded, instant)
const DOMAIN_VENDOR_MAP: Record<string, { name: string; category: string }> = {
  'kpn.com': { name: 'KPN', category: 'telecom' }, 'ziggo.nl': { name: 'Ziggo', category: 'telecom' },
  'odido.nl': { name: 'Odido', category: 'telecom' }, 'tele2.nl': { name: 'Tele2', category: 'telecom' },
  'vattenfall.nl': { name: 'Vattenfall', category: 'nutsvoorzieningen' },
  'eneco.nl': { name: 'Eneco', category: 'nutsvoorzieningen' }, 'essent.nl': { name: 'Essent', category: 'nutsvoorzieningen' },
  'greenchoice.nl': { name: 'Greenchoice', category: 'nutsvoorzieningen' },
  'waternet.nl': { name: 'Waternet', category: 'nutsvoorzieningen' },
  'zilverenkruis.nl': { name: 'Zilveren Kruis', category: 'verzekeringen' },
  'cz.nl': { name: 'CZ', category: 'verzekeringen' }, 'menzis.nl': { name: 'Menzis', category: 'verzekeringen' },
  'belastingdienst.nl': { name: 'Belastingdienst', category: 'overheid' },
  'cjib.nl': { name: 'CJIB', category: 'overheid' }, 'duo.nl': { name: 'DUO', category: 'overheid' },
  'svb.nl': { name: 'SVB', category: 'overheid' }, 'uwv.nl': { name: 'UWV', category: 'overheid' },
  'syncasso.nl': { name: 'Syncasso', category: 'incasso' }, 'ggn.nl': { name: 'GGN', category: 'incasso' },
  'flanderijn.nl': { name: 'Flanderijn', category: 'incasso' }, 'intrum.nl': { name: 'Intrum', category: 'incasso' },
  'klarna.com': { name: 'Klarna', category: 'winkels' }, 'afterpay.nl': { name: 'Afterpay', category: 'winkels' },
  'ns.nl': { name: 'NS', category: 'vervoer' },
  'basic-fit.com': { name: 'Basic-Fit', category: 'abonnementen' },
  'spotify.com': { name: 'Spotify', category: 'abonnementen' }, 'netflix.com': { name: 'Netflix', category: 'abonnementen' },
  'ing.nl': { name: 'ING', category: 'leningen' }, 'rabobank.nl': { name: 'Rabobank', category: 'leningen' },
  'abnamro.nl': { name: 'ABN AMRO', category: 'leningen' },
};
// NOTE: This is a subset for instant domain lookups. The full 454 vendors are in Supabase vendor_category_map.

function lookupDomain(email: string): { name: string; category: string } | null {
  if (!email) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  if (DOMAIN_VENDOR_MAP[domain]) return DOMAIN_VENDOR_MAP[domain];
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (DOMAIN_VENDOR_MAP[parent]) return DOMAIN_VENDOR_MAP[parent];
  }
  return null;
}

// 7b. Vendor from "From" display name (for generic domains)
export function extractVendorFromSenderName(fromHeader: string): string | null {
  // "KPN via Exact" <no-reply@exact-online.nl> → "KPN via Exact"
  const nameMatch = fromHeader.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name.length >= 2 && name.length <= 60) return name;
  }
  return null;
}

// 7c. Vendor from text
function extractVendorFromText(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const labelPatterns = [
    /(?:afzender|van|from|crediteur|begunstigde)[:\s]+(.+)/i,
    /(?:namens|opdrachtgever|in opdracht van)[:\s]+(.+)/i,
  ];
  for (const line of lines.slice(0, 20)) {
    for (const p of labelPatterns) {
      const m = line.match(p);
      if (m?.[1]) {
        const name = m[1].trim().replace(/[,;].*$/, '').trim();
        if (name.length >= 2 && name.length <= 80) return name;
      }
    }
  }
  for (const line of lines.slice(0, 15)) {
    if (/\b(B\.?V\.?|N\.?V\.?|Stichting|Gemeente|Coöperatie|Vereniging)\b/i.test(line)) {
      const cleaned = line.replace(/^[^a-zA-Z]+/, '').replace(/\s{2,}.*$/, '').trim();
      if (cleaned.length >= 3 && cleaned.length <= 80) return cleaned;
    }
  }
  for (const line of lines.slice(0, 10)) {
    if (/^[A-Z][a-z]/.test(line) && line.split(/\s+/).length <= 5 && line.length <= 50) {
      if (/^(Factuur|Rekening|Herinnering|Aanmaning|Geachte|Datum|Pagina|Betreft)/i.test(line)) continue;
      return line;
    }
  }
  return null;
}

// 7d. Secondary vendor ("opdrachtgever", "namens")
function extractSecondaryVendor(text: string): string | null {
  const patterns = [
    /(?:onze\s+)?opdrachtgever[:\s]+([A-Z][\w\s.&-]+)/i,
    /namens[:\s]+([A-Z][\w\s.&-]+)/i,
    /inzake[:\s]+([A-Z][\w\s.&-]+)/i,
    /ten\s+behoeve\s+van[:\s]+([A-Z][\w\s.&-]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const name = m[1].trim().replace(/[,;.]$/, '').trim();
      if (name.length >= 2 && name.length <= 80) return name;
    }
  }
  return null;
}

// ============================================================
// 8. DB LOOKUPS
// ============================================================

async function matchVendorFromDB(vendorText: string): Promise<{ display_name: string; category: string } | null> {
  if (!vendorText || vendorText.length < 2) return null;
  const supabase = createServiceRoleClient();
  const search = vendorText.toLowerCase().trim();
  const { data } = await supabase
    .from('vendor_category_map')
    .select('vendor_display_name, category')
    .or(`vendor_pattern.ilike.%${search}%,vendor_display_name.ilike.%${search}%`)
    .limit(1);
  if (data?.[0]) return { display_name: data[0].vendor_display_name, category: data[0].category };
  return null;
}

async function matchIncassoFromDB(vendorText: string): Promise<{ name: string } | null> {
  if (!vendorText || vendorText.length < 3) return null;
  const supabase = createServiceRoleClient();
  const search = vendorText.toLowerCase().trim();
  const { data } = await supabase
    .from('incasso_agencies')
    .select('name')
    .or(`search_name.ilike.%${search}%,name.ilike.%${search}%`)
    .limit(1);
  if (data?.[0]) return { name: data[0].name };
  return null;
}

async function matchLearnedCorrection(vendorText: string, senderDomain?: string): Promise<{ vendor: string; category: string | null } | null> {
  const supabase = createServiceRoleClient();
  if (senderDomain) {
    const { data } = await supabase.from('vendor_corrections')
      .select('corrected_vendor, corrected_category')
      .eq('sender_domain', senderDomain.toLowerCase()).order('times_seen', { ascending: false }).limit(1);
    if (data?.[0]) return { vendor: data[0].corrected_vendor, category: data[0].corrected_category };
  }
  if (vendorText) {
    const { data } = await supabase.from('vendor_corrections')
      .select('corrected_vendor, corrected_category')
      .eq('ocr_text', vendorText.toLowerCase().trim()).order('times_seen', { ascending: false }).limit(1);
    if (data?.[0]) return { vendor: data[0].corrected_vendor, category: data[0].corrected_category };
  }
  return null;
}

// ============================================================
// 9. MAIN EXTRACTION (async)
// ============================================================

export async function extractFromText(
  text: string,
  senderEmail?: string,
  senderName?: string
): Promise<RegexExtractionResult> {
  const fieldsFound: string[] = [];
  const matchSources: string[] = [];

  // --- Vendor resolution (waterfall) ---
  let vendor: string | null = null;
  let category = 'overig';
  let isIncasso = false;

  // Layer 1: Domain map
  if (senderEmail) {
    const dm = lookupDomain(senderEmail);
    if (dm) {
      vendor = dm.name; category = dm.category; isIncasso = category === 'incasso';
      fieldsFound.push('vendor'); matchSources.push('domain_map');
    }
  }

  // Layer 1b: Sender display name (for generic domains)
  if (!vendor && senderName) {
    const fromName = extractVendorFromSenderName(senderName);
    if (fromName) {
      const dbMatch = await matchVendorFromDB(fromName);
      if (dbMatch) {
        vendor = dbMatch.display_name; category = dbMatch.category;
        fieldsFound.push('vendor'); matchSources.push('sender_name');
      }
    }
  }

  // Layer 2: Learned corrections
  if (!vendor) {
    const rawVendor = extractVendorFromText(text);
    const domain = senderEmail?.split('@')[1];
    const learned = await matchLearnedCorrection(rawVendor || '', domain);
    if (learned) {
      vendor = learned.vendor; if (learned.category) category = learned.category;
      fieldsFound.push('vendor'); matchSources.push('learned');
    } else if (rawVendor) {
      vendor = rawVendor;
    }
  }

  // Layer 3: vendor_category_map (454)
  if (vendor && !matchSources.includes('domain_map')) {
    const dbMatch = await matchVendorFromDB(vendor);
    if (dbMatch) {
      vendor = dbMatch.display_name; category = dbMatch.category;
      if (!fieldsFound.includes('vendor')) fieldsFound.push('vendor');
      matchSources.push('vendor_db');
    }
  }

  // Layer 4: incasso_agencies (270)
  if (vendor) {
    const incassoMatch = await matchIncassoFromDB(vendor);
    if (incassoMatch) {
      vendor = incassoMatch.name; category = 'incasso'; isIncasso = true;
      if (!fieldsFound.includes('vendor')) fieldsFound.push('vendor');
      matchSources.push('incasso_db');
    }
  }

  if (vendor && !fieldsFound.includes('vendor')) {
    fieldsFound.push('vendor'); matchSources.push('regex');
  }

  // Secondary vendor
  const secondary_vendor = extractSecondaryVendor(text);

  // --- Structured fields ---
  const iban = extractIban(text);
  if (iban) fieldsFound.push('iban');

  const amount_cents = extractAmount(text);
  if (amount_cents) fieldsFound.push('amount');

  const due_date = extractDueDate(text);
  if (due_date) fieldsFound.push('due_date');

  const reference = extractReference(text);
  if (reference) fieldsFound.push('reference');

  const payment_url = extractPaymentUrl(text);
  if (payment_url) fieldsFound.push('payment_url');

  const escalation_stage = detectEscalationStage(text);
  if (escalation_stage) {
    fieldsFound.push('escalation_stage');
    if (escalation_stage === 'incasso' || escalation_stage === 'deurwaarder') isIncasso = true;
  }

  const kvk_number = extractKvkNumber(text);
  if (kvk_number) fieldsFound.push('kvk');

  const btw_id = extractBtwId(text);
  if (btw_id) fieldsFound.push('btw');

  if (category !== 'overig') fieldsFound.push('category');

  // Confidence
  const weights: Record<string, number> = { vendor: 0.25, amount: 0.3, iban: 0.2, due_date: 0.15, reference: 0.1 };
  let confidence = 0;
  for (const [field, weight] of Object.entries(weights)) {
    if (fieldsFound.includes(field)) confidence += weight;
  }

  return {
    vendor, secondary_vendor, amount_cents, iban, reference, due_date, payment_url,
    escalation_stage, category_hint: category, is_incasso: isIncasso,
    kvk_number, btw_id, method: 'regex', fields_found: fieldsFound,
    confidence: Math.round(confidence * 100) / 100, match_sources: matchSources,
  };
}

// ============================================================
// 10. EMAIL HTML STRIPPING (for email pipeline)
// ============================================================

/**
 * Strip HTML tags and decode entities for clean text extraction.
 * Used before running regex on email bodies.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // remove style blocks
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // remove scripts
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ') // remove all remaining tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&euro;/gi, '€')
    .replace(/&#8364;/gi, '€')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// ============================================================
// PIPELINE COMPATIBILITY WRAPPERS
// ============================================================

/** Quick sync extraction for pipeline integration */
export function regexExtract(text: string): RegexExtractionResult {
  const iban = extractIban(text);
  const amount = extractAmount(text);
  const dueDate = extractDueDate(text);
  const reference = extractReference(text);
  const paymentUrl = extractPaymentUrl(text);
  const escalation = detectEscalationStage(text);
  const kvk = extractKvkNumber(text);
  const btw = extractBtwId(text);

  const fieldsFound: string[] = [];
  if (iban) fieldsFound.push('iban');
  if (amount) fieldsFound.push('amount');
  if (dueDate) fieldsFound.push('due_date');
  if (reference) fieldsFound.push('reference');
  if (paymentUrl) fieldsFound.push('payment_url');
  if (escalation) fieldsFound.push('escalation_stage');

  return {
    vendor: null,
    secondary_vendor: null,
    amount_cents: amount,
    iban,
    reference,
    due_date: dueDate,
    payment_url: paymentUrl,
    escalation_stage: escalation,
    category_hint: 'overig',
    is_incasso: false,
    kvk_number: kvk,
    btw_id: btw,
    method: 'regex',
    fields_found: fieldsFound,
    confidence: fieldsFound.length / 6,
    match_sources: ['sync_regex'],
  };
}

/** Check if regex result is insufficient and needs AI fallback */
export function needsAiFallback(result: RegexExtractionResult): boolean {
  // Need AI if we're missing critical fields
  const hasCritical = result.vendor && result.amount_cents && result.due_date;
  return !hasCritical || result.confidence < 0.5;
}
