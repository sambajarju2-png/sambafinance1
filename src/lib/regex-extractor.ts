/**
 * PayWatch Regex Extraction Engine v3 — DB-Powered
 *
 * Uses 3 Supabase tables for vendor intelligence:
 * - vendor_category_map (291 patterns) — vendor name → category + display name
 * - incasso_agencies (270 agencies) — Justis register with search names
 * - vendor_corrections (learned) — user corrections that grow over time
 *
 * Plus hardcoded domain map for email sender → vendor (instant, no DB call).
 * Plus deterministic regex for IBAN, amounts, dates, references, escalation.
 *
 * SERVER-ONLY — never import in client components.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';

// ============================================================
// TYPES
// ============================================================

export interface RegexExtractionResult {
  vendor: string | null;
  amount_cents: number | null;
  iban: string | null;
  reference: string | null;
  due_date: string | null;
  payment_url: string | null;
  escalation_stage: string | null;
  category_hint: string;
  is_incasso: boolean;
  method: 'regex';
  fields_found: string[];
  confidence: number;
  match_sources: string[]; // e.g. ['domain_map', 'vendor_db', 'incasso_db', 'regex']
}

// ============================================================
// 1. IBAN EXTRACTION + MOD-97 VALIDATION
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

export function extractIban(text: string): string | null {
  const upperText = text.toUpperCase();
  const paymentKeywords = [
    'BETAALINFORMATIE', 'OVERMAKEN NAAR', 'BETALEN AAN', 'IBAN',
    'REKENINGNUMMER', 'BANKREKENING', 'CREDITEUR', 'BEGUNSTIGDE',
  ];

  for (const keyword of paymentKeywords) {
    const idx = upperText.indexOf(keyword);
    if (idx === -1) continue;
    const window = upperText.slice(idx, idx + 250);
    const matches = [
      ...(window.match(IBAN_STRICT) || []),
      ...(window.match(IBAN_REGEX) || []).map((m) => m.replace(/\s/g, '')),
    ];
    for (const raw of matches) {
      if (validateIbanMod97(raw)) return raw;
    }
  }

  const all = [
    ...(upperText.match(IBAN_STRICT) || []),
    ...(upperText.match(IBAN_REGEX) || []).map((m) => m.replace(/\s/g, '')),
  ];
  for (const raw of Array.from(new Set(all))) {
    if (validateIbanMod97(raw)) return raw;
  }
  return null;
}

// ============================================================
// 2. AMOUNT EXTRACTION (Dutch format)
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

export function extractAmount(text: string): number | null {
  const lines = text.split('\n').map((l) => l.trim());

  const anchorPatterns = [
    /(?:totaal\s+)?te\s+betalen[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /nog\s+te\s+betalen[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /(?:totaal|total|totaalbedrag)[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /openstaand\s*(?:bedrag|saldo)[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /verschuldigd[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /factuurbedrag[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /hoofdsom[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /(?:€|EUR)\s?([\d.,]+[-]?)\s*(?:te\s+betalen|verschuldigd|openstaand)/i,
  ];

  for (const pattern of anchorPatterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const cents = parseDutchAmount(match[1]);
        if (cents && cents >= 50) return cents;
      }
    }
  }

  const amountRegex = /(?:€|EUR)\s?([\d]{1,3}(?:\.?\d{3})*(?:,\d{2})?[-]?)/g;
  const amounts: number[] = [];
  for (const line of lines) {
    let match;
    while ((match = amountRegex.exec(line)) !== null) {
      const cents = parseDutchAmount(match[1]);
      if (cents && cents >= 50) amounts.push(cents);
    }
  }
  if (amounts.length > 0) return Math.max(...amounts);

  const bare = /\b(\d{1,6},\d{2})\b/g;
  const bareAmounts: number[] = [];
  let bm;
  while ((bm = bare.exec(text)) !== null) {
    const cents = parseDutchAmount(bm[1]);
    if (cents && cents >= 500) bareAmounts.push(cents);
  }
  if (bareAmounts.length > 0) return Math.max(...bareAmounts);
  return null;
}

// ============================================================
// 3. DATE EXTRACTION
// ============================================================

const DUTCH_MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maart: '03', april: '04', mei: '05', juni: '06',
  juli: '07', augustus: '08', september: '09', oktober: '10', november: '11', december: '12',
  jan: '01', feb: '02', mrt: '03', apr: '04', jun: '06', jul: '07',
  aug: '08', sep: '09', okt: '10', nov: '11', dec: '12',
};

function parseDate(raw: string): string | null {
  const dmy = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const di = parseInt(d), mi = parseInt(m), yi = parseInt(y);
    if (mi >= 1 && mi <= 12 && di >= 1 && di <= 31 && yi >= 2020 && yi <= 2030) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  const dutchDate = raw.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|okt|nov|dec)\.?\s+(\d{4})/i);
  if (dutchDate) {
    const [, d, monthStr, y] = dutchDate;
    const m = DUTCH_MONTHS[monthStr.toLowerCase().replace('.', '')];
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`;
  }
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return null;
}

export function extractDueDate(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim());
  const keywords = [
    'vervaldatum', 'uiterste betaaldatum', 'betaal voor', 'uiterlijk',
    'vóór', 'betaaldatum', 'te voldoen voor', 'te betalen voor',
  ];

  for (const kw of keywords) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(kw)) {
        const date = parseDate(lines[i]) || (i < lines.length - 1 ? parseDate(lines[i + 1]) : null);
        if (date) return date;
      }
    }
  }

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
// 4. REFERENCE + PAYMENT URL + ESCALATION (same as v2)
// ============================================================

export function extractReference(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim());
  const patterns = [
    { r: /betalingskenmerk[:\s]*([\w\d\s.-]+)/i, p: 1 },
    { r: /betaalreferentie[:\s]*([\w\d\s.-]+)/i, p: 1 },
    { r: /(?:ons\s+)?kenmerk[:\s]*([\w\d\s.-]+)/i, p: 2 },
    { r: /dossiernummer[:\s]*([\w\d.-]+)/i, p: 3 },
    { r: /factuurnummer[:\s]*([\w\d.-]+)/i, p: 4 },
    { r: /referentie(?:nummer)?[:\s]*([\w\d.-]+)/i, p: 5 },
    { r: /factuur(?:nr)?\.?[:\s]*([\w\d.-]+)/i, p: 6 },
    { r: /zaak(?:nummer)?[:\s]*([\w\d.-]+)/i, p: 7 },
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
  const pay = ['betaal', 'pay', 'invoice', 'factuur', 'ideal', 'tikkie', 'mollie'];
  const skip = ['unsubscribe', 'afmelden', 'uitschrijven', 'privacy', 'cookie'];
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

const ESCALATION_KEYWORDS: { stage: string; keywords: string[]; weight: number }[] = [
  { stage: 'deurwaarder', keywords: ['deurwaarder', 'gerechtsdeurwaarder', 'exploot', 'dagvaarding', 'beslag', 'executoriaal', 'dwangbevel', 'vonnis', 'rechtbank', 'beslagvrije voet', 'loonbeslag'], weight: 5 },
  { stage: 'incasso', keywords: ['incasso', 'incassobureau', 'vordering', 'namens onze opdrachtgever', 'buitengerechtelijke kosten', 'buitengerechtelijke incassokosten', 'wettelijke rente', 'ingebrekestelling', 'wik-kosten', 'overdracht aan', 'collection'], weight: 4 },
  { stage: 'aanmaning', keywords: ['aanmaning', 'laatste waarschuwing', 'sommatie', 'dringend verzoek', 'wanbetaling', 'in gebreke', 'verzuim', 'onbetaald gebleven', 'tweede herinnering', '2e herinnering', 'finale herinnering'], weight: 3 },
  { stage: 'herinnering', keywords: ['herinnering', 'betalingsherinnering', 'reminder', 'eerste herinnering', '1e herinnering', 'nog niet ontvangen', 'vriendelijk verzoek'], weight: 2 },
  { stage: 'factuur', keywords: ['factuur', 'nota', 'rekening', 'invoice', 'termijnbedrag', 'maandbedrag', 'voorschotnota'], weight: 1 },
];

export function detectEscalationStage(text: string): string | null {
  const lower = text.toLowerCase();
  let bestStage: string | null = null;
  let bestWeight = 0;
  for (const { stage, keywords, weight } of ESCALATION_KEYWORDS) {
    let count = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) count++;
    }
    if (count > 0 && weight > bestWeight) { bestStage = stage; bestWeight = weight; }
  }
  return bestStage;
}

// ============================================================
// 5. DOMAIN MAP (hardcoded for instant email sender lookup)
// ============================================================

const DOMAIN_VENDOR_MAP: Record<string, { name: string; category: string }> = {
  // Telecom
  'kpn.com': { name: 'KPN', category: 'telecom' }, 'info.nl.kpn.com': { name: 'KPN', category: 'telecom' },
  'ziggo.nl': { name: 'Ziggo', category: 'telecom' }, 'vodafoneziggo.nl': { name: 'VodafoneZiggo', category: 'telecom' },
  'odido.nl': { name: 'Odido', category: 'telecom' }, 'tele2.nl': { name: 'Tele2', category: 'telecom' },
  'tmobile.nl': { name: 'T-Mobile', category: 'telecom' }, 'simyo.nl': { name: 'Simyo', category: 'telecom' },
  'youfone.nl': { name: 'Youfone', category: 'telecom' },
  // Energy
  'vattenfall.nl': { name: 'Vattenfall', category: 'nutsvoorzieningen' }, 'vattenfall.com': { name: 'Vattenfall', category: 'nutsvoorzieningen' },
  'eneco.nl': { name: 'Eneco', category: 'nutsvoorzieningen' }, 'essent.nl': { name: 'Essent', category: 'nutsvoorzieningen' },
  'greenchoice.nl': { name: 'Greenchoice', category: 'nutsvoorzieningen' }, 'budgetenergie.nl': { name: 'Budget Energie', category: 'nutsvoorzieningen' },
  'engie.nl': { name: 'ENGIE', category: 'nutsvoorzieningen' }, 'energiedirect.nl': { name: 'Energiedirect', category: 'nutsvoorzieningen' },
  'vandebron.nl': { name: 'Vandebron', category: 'nutsvoorzieningen' }, 'tibber.com': { name: 'Tibber', category: 'nutsvoorzieningen' },
  // Water
  'waternet.nl': { name: 'Waternet', category: 'nutsvoorzieningen' }, 'evides.nl': { name: 'Evides', category: 'nutsvoorzieningen' },
  'vitens.nl': { name: 'Vitens', category: 'nutsvoorzieningen' }, 'dunea.nl': { name: 'Dunea', category: 'nutsvoorzieningen' },
  'brabantwater.nl': { name: 'Brabant Water', category: 'nutsvoorzieningen' }, 'pwn.nl': { name: 'PWN', category: 'nutsvoorzieningen' },
  // Insurance
  'zilverenkruis.nl': { name: 'Zilveren Kruis', category: 'verzekeringen' }, 'cz.nl': { name: 'CZ', category: 'verzekeringen' },
  'menzis.nl': { name: 'Menzis', category: 'verzekeringen' }, 'vgz.nl': { name: 'VGZ', category: 'verzekeringen' },
  'ohra.nl': { name: 'OHRA', category: 'verzekeringen' }, 'interpolis.nl': { name: 'Interpolis', category: 'verzekeringen' },
  'centraal-beheer.nl': { name: 'Centraal Beheer', category: 'verzekeringen' }, 'achmea.nl': { name: 'Achmea', category: 'verzekeringen' },
  'nn.nl': { name: 'Nationale-Nederlanden', category: 'verzekeringen' }, 'aegon.nl': { name: 'Aegon', category: 'verzekeringen' },
  'unive.nl': { name: 'Univé', category: 'verzekeringen' },
  // Government
  'belastingdienst.nl': { name: 'Belastingdienst', category: 'overheid' }, 'cjib.nl': { name: 'CJIB', category: 'overheid' },
  'noreply.cjib.nl': { name: 'CJIB', category: 'overheid' }, 'duo.nl': { name: 'DUO', category: 'overheid' },
  'svb.nl': { name: 'SVB', category: 'overheid' }, 'cak.nl': { name: 'CAK', category: 'overheid' },
  'uwv.nl': { name: 'UWV', category: 'overheid' }, 'rdw.nl': { name: 'RDW', category: 'overheid' },
  // Gemeentes (top 60)
  'amsterdam.nl': { name: 'Gemeente Amsterdam', category: 'overheid' }, 'rotterdam.nl': { name: 'Gemeente Rotterdam', category: 'overheid' },
  'utrecht.nl': { name: 'Gemeente Utrecht', category: 'overheid' }, 'denhaag.nl': { name: 'Gemeente Den Haag', category: 'overheid' },
  'eindhoven.nl': { name: 'Gemeente Eindhoven', category: 'overheid' }, 'groningen.nl': { name: 'Gemeente Groningen', category: 'overheid' },
  'tilburg.nl': { name: 'Gemeente Tilburg', category: 'overheid' }, 'almere.nl': { name: 'Gemeente Almere', category: 'overheid' },
  'breda.nl': { name: 'Gemeente Breda', category: 'overheid' }, 'nijmegen.nl': { name: 'Gemeente Nijmegen', category: 'overheid' },
  'apeldoorn.nl': { name: 'Gemeente Apeldoorn', category: 'overheid' }, 'haarlem.nl': { name: 'Gemeente Haarlem', category: 'overheid' },
  'enschede.nl': { name: 'Gemeente Enschede', category: 'overheid' }, 'arnhem.nl': { name: 'Gemeente Arnhem', category: 'overheid' },
  'amersfoort.nl': { name: 'Gemeente Amersfoort', category: 'overheid' }, 'zwolle.nl': { name: 'Gemeente Zwolle', category: 'overheid' },
  'leiden.nl': { name: 'Gemeente Leiden', category: 'overheid' }, 'dordrecht.nl': { name: 'Gemeente Dordrecht', category: 'overheid' },
  'deventer.nl': { name: 'Gemeente Deventer', category: 'overheid' }, 'leeuwarden.nl': { name: 'Gemeente Leeuwarden', category: 'overheid' },
  'alkmaar.nl': { name: 'Gemeente Alkmaar', category: 'overheid' }, 'delft.nl': { name: 'Gemeente Delft', category: 'overheid' },
  'hilversum.nl': { name: 'Gemeente Hilversum', category: 'overheid' }, 'gouda.nl': { name: 'Gemeente Gouda', category: 'overheid' },
  // Housing
  'vestia.nl': { name: 'Vestia', category: 'wonen' }, 'woonstad.nl': { name: 'Woonstad Rotterdam', category: 'wonen' },
  'havensteder.nl': { name: 'Havensteder', category: 'wonen' }, 'woonbron.nl': { name: 'Woonbron', category: 'wonen' },
  'staedion.nl': { name: 'Staedion', category: 'wonen' }, 'ymere.nl': { name: 'Ymere', category: 'wonen' },
  'eigenhaard.nl': { name: 'Eigen Haard', category: 'wonen' }, 'portaal.nl': { name: 'Portaal', category: 'wonen' },
  'rochdale.nl': { name: 'Rochdale', category: 'wonen' }, 'stadgenoot.nl': { name: 'Stadgenoot', category: 'wonen' },
  // Incasso (major ones)
  'syncasso.nl': { name: 'Syncasso', category: 'incasso' }, 'ggn.nl': { name: 'GGN', category: 'incasso' },
  'flanderijn.nl': { name: 'Flanderijn', category: 'incasso' }, 'cannock.nl': { name: 'Cannock', category: 'incasso' },
  'coeo-incasso.nl': { name: 'Coeo', category: 'incasso' }, 'intrum.nl': { name: 'Intrum', category: 'incasso' },
  'straetus.nl': { name: 'Straetus', category: 'incasso' }, 'yards.nl': { name: 'Yards', category: 'incasso' },
  // BNPL
  'klarna.com': { name: 'Klarna', category: 'winkels' }, 'afterpay.nl': { name: 'Afterpay', category: 'winkels' },
  'billink.nl': { name: 'Billink', category: 'winkels' }, 'riverty.com': { name: 'Riverty', category: 'winkels' },
  // Transport
  'ns.nl': { name: 'NS', category: 'vervoer' }, 'translink.nl': { name: 'OV-chipkaart', category: 'vervoer' },
  // Healthcare
  'erasmusmc.nl': { name: 'Erasmus MC', category: 'zorg' }, 'amsterdamumc.nl': { name: 'Amsterdam UMC', category: 'zorg' },
  // Shops + Subscriptions
  'bol.com': { name: 'Bol.com', category: 'winkels' }, 'coolblue.nl': { name: 'Coolblue', category: 'winkels' },
  'spotify.com': { name: 'Spotify', category: 'abonnementen' }, 'netflix.com': { name: 'Netflix', category: 'abonnementen' },
  // Fitness
  'basic-fit.com': { name: 'Basic-Fit', category: 'abonnementen' }, 'trainmore.nl': { name: 'TrainMore', category: 'abonnementen' },
  // Parking
  'q-park.nl': { name: 'Q-Park', category: 'vervoer' }, 'parkmobile.nl': { name: 'Parkmobile', category: 'vervoer' },
  // Banks (for statements)
  'ing.nl': { name: 'ING', category: 'leningen' }, 'rabobank.nl': { name: 'Rabobank', category: 'leningen' },
  'abnamro.nl': { name: 'ABN AMRO', category: 'leningen' },
  // PostNL
  'postnl.nl': { name: 'PostNL', category: 'winkels' },
};

function lookupDomain(senderEmail: string): { name: string; category: string } | null {
  if (!senderEmail) return null;
  const domain = senderEmail.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  if (DOMAIN_VENDOR_MAP[domain]) return DOMAIN_VENDOR_MAP[domain];
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (DOMAIN_VENDOR_MAP[parent]) return DOMAIN_VENDOR_MAP[parent];
  }
  return null;
}

// ============================================================
// 6. DB-POWERED VENDOR + INCASSO MATCHING
// ============================================================

/**
 * Search vendor_category_map (291 patterns) for a match.
 * Uses ILIKE for case-insensitive partial matching.
 */
async function matchVendorFromDB(vendorText: string): Promise<{ display_name: string; category: string } | null> {
  if (!vendorText || vendorText.length < 2) return null;
  const supabase = createServiceRoleClient();
  const search = vendorText.toLowerCase().trim();

  const { data } = await supabase
    .from('vendor_category_map')
    .select('vendor_display_name, category, vendor_pattern')
    .or(`vendor_pattern.ilike.%${search}%,vendor_display_name.ilike.%${search}%`)
    .limit(1);

  if (data && data.length > 0) {
    return { display_name: data[0].vendor_display_name, category: data[0].category };
  }
  return null;
}

/**
 * Check if vendor matches any of the 270 Justis-registered incasso agencies.
 */
async function matchIncassoFromDB(vendorText: string): Promise<{ name: string; matched: boolean } | null> {
  if (!vendorText || vendorText.length < 3) return null;
  const supabase = createServiceRoleClient();
  const search = vendorText.toLowerCase().trim();

  const { data } = await supabase
    .from('incasso_agencies')
    .select('name, search_name')
    .or(`search_name.ilike.%${search}%,name.ilike.%${search}%`)
    .limit(1);

  if (data && data.length > 0) {
    return { name: data[0].name, matched: true };
  }
  return null;
}

/**
 * Check vendor_corrections table for learned corrections.
 */
async function matchLearnedCorrection(vendorText: string, senderDomain?: string): Promise<{ vendor: string; category: string | null } | null> {
  if (!vendorText && !senderDomain) return null;
  const supabase = createServiceRoleClient();

  // Try domain first
  if (senderDomain) {
    const { data } = await supabase
      .from('vendor_corrections')
      .select('corrected_vendor, corrected_category')
      .eq('sender_domain', senderDomain.toLowerCase())
      .order('times_seen', { ascending: false })
      .limit(1);
    if (data?.[0]) return { vendor: data[0].corrected_vendor, category: data[0].corrected_category };
  }

  // Try OCR text
  if (vendorText) {
    const { data } = await supabase
      .from('vendor_corrections')
      .select('corrected_vendor, corrected_category')
      .eq('ocr_text', vendorText.toLowerCase().trim())
      .order('times_seen', { ascending: false })
      .limit(1);
    if (data?.[0]) return { vendor: data[0].corrected_vendor, category: data[0].corrected_category };
  }

  return null;
}

// ============================================================
// 7. VENDOR FROM TEXT (regex patterns)
// ============================================================

function extractVendorFromText(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const labelPatterns = [
    /(?:afzender|van|from|crediteur|begunstigde)[:\s]+(.+)/i,
    /(?:namens|opdrachtgever|in opdracht van)[:\s]+(.+)/i,
  ];
  for (const line of lines.slice(0, 20)) {
    for (const pattern of labelPatterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        const name = match[1].trim().replace(/[,;].*$/, '').trim();
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

// ============================================================
// 8. MAIN EXTRACTION (async — queries DB)
// ============================================================

export async function extractFromText(
  text: string,
  senderEmail?: string
): Promise<RegexExtractionResult> {
  const fieldsFound: string[] = [];
  const matchSources: string[] = [];

  // --- Vendor resolution (waterfall) ---
  let vendor: string | null = null;
  let category = 'overig';
  let isIncasso = false;

  // Layer 1: Domain lookup (instant, no DB)
  if (senderEmail) {
    const domainResult = lookupDomain(senderEmail);
    if (domainResult) {
      vendor = domainResult.name;
      category = domainResult.category;
      isIncasso = category === 'incasso';
      fieldsFound.push('vendor');
      matchSources.push('domain_map');
    }
  }

  // Layer 2: Learned corrections (DB)
  if (!vendor) {
    const rawVendor = extractVendorFromText(text);
    const domain = senderEmail?.split('@')[1];
    const learned = await matchLearnedCorrection(rawVendor || '', domain);
    if (learned) {
      vendor = learned.vendor;
      if (learned.category) category = learned.category;
      fieldsFound.push('vendor');
      matchSources.push('learned_correction');
    } else if (rawVendor) {
      vendor = rawVendor;
    }
  }

  // Layer 3: vendor_category_map DB (291 patterns)
  if (vendor) {
    const dbMatch = await matchVendorFromDB(vendor);
    if (dbMatch) {
      vendor = dbMatch.display_name;
      category = dbMatch.category;
      if (!fieldsFound.includes('vendor')) fieldsFound.push('vendor');
      matchSources.push('vendor_db');
    }
  }

  // Layer 4: incasso_agencies DB (270 agencies)
  if (vendor) {
    const incassoMatch = await matchIncassoFromDB(vendor);
    if (incassoMatch) {
      vendor = incassoMatch.name;
      category = 'incasso';
      isIncasso = true;
      if (!fieldsFound.includes('vendor')) fieldsFound.push('vendor');
      matchSources.push('incasso_db');
    }
  }

  // If still no vendor match source, add generic
  if (vendor && !fieldsFound.includes('vendor')) {
    fieldsFound.push('vendor');
    matchSources.push('regex');
  }

  // --- Structured fields (deterministic regex) ---
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

  if (category !== 'overig') fieldsFound.push('category');

  // Confidence
  const weights: Record<string, number> = { vendor: 0.25, amount: 0.3, iban: 0.2, due_date: 0.15, reference: 0.1 };
  let confidence = 0;
  for (const [field, weight] of Object.entries(weights)) {
    if (fieldsFound.includes(field)) confidence += weight;
  }

  return {
    vendor,
    amount_cents,
    iban,
    reference,
    due_date,
    payment_url,
    escalation_stage,
    category_hint: category,
    is_incasso: isIncasso,
    method: 'regex',
    fields_found: fieldsFound,
    confidence: Math.round(confidence * 100) / 100,
    match_sources: matchSources,
  };
}
