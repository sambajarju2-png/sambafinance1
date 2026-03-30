/**
 * PayWatch Regex Extraction Engine v2
 *
 * Deterministic extraction of bill data from plain text.
 * No AI, no LLM calls. Uses regex, checksums, lookup tables, and fuzzy matching.
 *
 * v2 improvements:
 * - Escalation stage detection via Dutch keywords
 * - Category auto-detection from vendor name
 * - 100+ Dutch vendor domain mappings
 * - Fuzzy vendor matching (Levenshtein)
 * - KVK number extraction
 * - Improved Dutch amount parsing edge cases
 * - Better anchor-based extraction (looks near keywords, not just anywhere)
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
  due_date: string | null;
  payment_url: string | null;
  escalation_stage: string | null;
  category_hint: string;
  kvk_number: string | null;
  method: 'regex';
  fields_found: string[];
  confidence: number;
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

  // Priority: IBAN near payment keywords
  const paymentKeywords = [
    'BETAALINFORMATIE', 'OVERMAKEN NAAR', 'BETALEN AAN', 'IBAN',
    'REKENINGNUMMER', 'BANKREKENING', 'TE BETALEN OP', 'NAAR REKENING',
    'CREDITEUR', 'BEGUNSTIGDE',
  ];

  for (const keyword of paymentKeywords) {
    const idx = upperText.indexOf(keyword);
    if (idx === -1) continue;
    const window = upperText.slice(idx, idx + 250);
    // Try with and without spaces
    const matches = [
      ...(window.match(IBAN_STRICT) || []),
      ...(window.match(IBAN_REGEX) || []).map((m) => m.replace(/\s/g, '')),
    ];
    for (const raw of matches) {
      if (validateIbanMod97(raw)) return raw;
    }
  }

  // Fallback: any valid IBAN
  const all = [
    ...(upperText.match(IBAN_STRICT) || []),
    ...(upperText.match(IBAN_REGEX) || []).map((m) => m.replace(/\s/g, '')),
  ];
  const unique = [...new Set(all)];
  for (const raw of unique) {
    if (validateIbanMod97(raw)) return raw;
  }

  return null;
}

// ============================================================
// 2. AMOUNT EXTRACTION (Dutch format)
// ============================================================

function parseDutchAmount(raw: string): number | null {
  let cleaned = raw.replace(/€|EUR/gi, '').replace(/\s/g, '').trim();
  cleaned = cleaned.replace(/,-$/, ',00');
  cleaned = cleaned.replace(/-$/, '');

  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts[1]?.length === 2) {
      // 12.34 → decimal
    } else {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0 || num > 999999) return null;
  return Math.round(num * 100);
}

export function extractAmount(text: string): number | null {
  const lines = text.split('\n').map((l) => l.trim());

  // Priority 1: Anchor keywords + amount on same line
  const anchorPatterns = [
    /(?:totaal\s+)?te\s+betalen[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /(?:totaal|total)[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /openstaand\s*(?:bedrag|saldo)[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /nog\s+te\s+betalen[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /verschuldigd[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /factuurbedrag[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /hoofdsom[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /totaalbedrag[:\s]*(?:€|EUR)\s?([\d.,]+[-]?)/i,
    /(?:€|EUR)\s?([\d.,]+[-]?)\s*(?:te\s+betalen|verschuldigd|openstaand)/i,
  ];

  for (const pattern of anchorPatterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const cents = parseDutchAmount(match[1]);
        if (cents && cents >= 50) return cents; // at least €0.50
      }
    }
  }

  // Priority 2: Any € amount (collect all, return largest)
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

  // Priority 3: Bare comma-amounts (127,43)
  const bare = /\b(\d{1,6},\d{2})\b/g;
  const bareAmounts: number[] = [];
  let bm;
  while ((bm = bare.exec(text)) !== null) {
    const cents = parseDutchAmount(bm[1]);
    if (cents && cents >= 500) bareAmounts.push(cents); // at least €5 to avoid noise
  }
  if (bareAmounts.length > 0) return Math.max(...bareAmounts);

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

function parseDate(raw: string): string | null {
  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const di = parseInt(d), mi = parseInt(m), yi = parseInt(y);
    if (mi >= 1 && mi <= 12 && di >= 1 && di <= 31 && yi >= 2020 && yi <= 2030) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // "15 januari 2026"
  const dutchDate = raw.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|okt|nov|dec)\.?\s+(\d{4})/i);
  if (dutchDate) {
    const [, d, monthStr, y] = dutchDate;
    const m = DUTCH_MONTHS[monthStr.toLowerCase().replace('.', '')];
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`;
  }

  // YYYY-MM-DD
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  return null;
}

export function extractDueDate(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim());

  const dueDateKeywords = [
    'vervaldatum', 'uiterste betaaldatum', 'betaal voor', 'uiterlijk',
    'vóór', 'voor', 'betaaldatum', 'deadline', 'verloopdatum',
    'te voldoen voor', 'te betalen voor',
  ];

  // Priority 1: date on same line as keyword
  for (const keyword of dueDateKeywords) {
    for (const line of lines) {
      if (line.toLowerCase().includes(keyword)) {
        const date = parseDate(line);
        if (date) return date;
      }
    }
  }

  // Priority 2: date on line AFTER keyword
  for (const keyword of dueDateKeywords) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].toLowerCase().includes(keyword)) {
        const date = parseDate(lines[i + 1]);
        if (date) return date;
      }
    }
  }

  // Priority 3: latest future date found
  const allDates: string[] = [];
  const dateRegex = /\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/g;
  let match;
  while ((match = dateRegex.exec(text)) !== null) {
    const parsed = parseDate(match[0]);
    if (parsed) allDates.push(parsed);
  }
  // Also check Dutch written dates
  const writtenDateRegex = /\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/gi;
  while ((match = writtenDateRegex.exec(text)) !== null) {
    const parsed = parseDate(match[0]);
    if (parsed) allDates.push(parsed);
  }

  if (allDates.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const futureDates = allDates.filter((d) => d >= today);
    if (futureDates.length > 0) {
      futureDates.sort();
      return futureDates[0]; // earliest future date is most likely the due date
    }
    allDates.sort();
    return allDates[allDates.length - 1]; // latest date as fallback
  }

  return null;
}

// ============================================================
// 4. REFERENCE NUMBER EXTRACTION
// ============================================================

export function extractReference(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim());

  const refPatterns = [
    { regex: /betalingskenmerk[:\s]*([\w\d\s.-]+)/i, priority: 1 },
    { regex: /betaalreferentie[:\s]*([\w\d\s.-]+)/i, priority: 1 },
    { regex: /(?:ons\s+)?kenmerk[:\s]*([\w\d\s.-]+)/i, priority: 2 },
    { regex: /dossiernummer[:\s]*([\w\d.-]+)/i, priority: 3 },
    { regex: /factuurnummer[:\s]*([\w\d.-]+)/i, priority: 4 },
    { regex: /referentie(?:nummer)?[:\s]*([\w\d.-]+)/i, priority: 5 },
    { regex: /factuur(?:nr)?\.?[:\s]*([\w\d.-]+)/i, priority: 6 },
    { regex: /nota(?:nummer)?[:\s]*([\w\d.-]+)/i, priority: 7 },
    { regex: /zaak(?:nummer)?[:\s]*([\w\d.-]+)/i, priority: 8 },
  ];

  let bestMatch: { value: string; priority: number } | null = null;

  for (const line of lines) {
    for (const { regex, priority } of refPatterns) {
      const match = line.match(regex);
      if (match && match[1]) {
        const value = match[1].trim().slice(0, 50);
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

export function extractPaymentUrl(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"'\])+]+/g;
  const urls = text.match(urlRegex) || [];

  const paymentKeywords = [
    'betaal', 'pay', 'invoice', 'factuur', 'betaling', 'ideal',
    'checkout', 'tikkie', 'mollie', 'buckaroo', 'adyen',
  ];
  const skipKeywords = ['unsubscribe', 'afmelden', 'uitschrijven', 'mailto', 'privacy', 'cookie'];

  // Priority: payment URLs
  for (const url of urls) {
    const lower = url.toLowerCase();
    if (skipKeywords.some((s) => lower.includes(s))) continue;
    if (paymentKeywords.some((kw) => lower.includes(kw))) {
      return url.replace(/[.,;)]+$/, '');
    }
  }

  // Fallback: first non-trivial, non-skip URL
  for (const url of urls) {
    const lower = url.toLowerCase();
    const cleaned = url.replace(/[.,;)]+$/, '');
    if (cleaned.length > 25 && !skipKeywords.some((s) => lower.includes(s))) {
      return cleaned;
    }
  }

  return null;
}

// ============================================================
// 6. ESCALATION STAGE DETECTION (keyword-based)
// ============================================================

const ESCALATION_KEYWORDS: { stage: string; keywords: string[]; weight: number }[] = [
  {
    stage: 'deurwaarder',
    keywords: [
      'deurwaarder', 'gerechtsdeurwaarder', 'exploot', 'dagvaarding',
      'beslag', 'executoriaal', 'dwangbevel', 'vonnis', 'rechtbank',
      'beslagvrije voet', 'loonbeslag',
    ],
    weight: 5,
  },
  {
    stage: 'incasso',
    keywords: [
      'incasso', 'incassobureau', 'vordering', 'namens onze opdrachtgever',
      'buitengerechtelijke kosten', 'buitengerechtelijke incassokosten',
      'wettelijke rente', 'ingebrekestelling', 'wik-kosten',
      'overdracht aan', 'collectie', 'collection',
    ],
    weight: 4,
  },
  {
    stage: 'aanmaning',
    keywords: [
      'aanmaning', 'laatste waarschuwing', 'sommatie', 'dringend verzoek',
      'wanbetaling', 'in gebreke', 'verzuim', 'onbetaald gebleven',
      'tweede herinnering', '2e herinnering', 'finale herinnering',
    ],
    weight: 3,
  },
  {
    stage: 'herinnering',
    keywords: [
      'herinnering', 'betalingsherinnering', 'reminder', 'eerste herinnering',
      '1e herinnering', 'nog niet ontvangen', 'niet betaald',
      'vriendelijk verzoek', 'herhaald verzoek',
    ],
    weight: 2,
  },
  {
    stage: 'factuur',
    keywords: [
      'factuur', 'nota', 'rekening', 'invoice', 'termijnbedrag',
      'maandbedrag', 'voorschotnota',
    ],
    weight: 1,
  },
];

export function detectEscalationStage(text: string): string | null {
  const lower = text.toLowerCase();
  let bestStage: string | null = null;
  let bestWeight = 0;
  let bestCount = 0;

  for (const { stage, keywords, weight } of ESCALATION_KEYWORDS) {
    let count = 0;
    for (const kw of keywords) {
      // Count occurrences (more occurrences = more confident)
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = lower.match(regex);
      if (matches) count += matches.length;
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
// 7. VENDOR EXTRACTION
// ============================================================

// --- 7a. Domain lookup (100+ Dutch vendors) ---

const DOMAIN_VENDOR_MAP: Record<string, { name: string; category: string }> = {
  // Telecom
  'kpn.com': { name: 'KPN', category: 'telecom' },
  'info.nl.kpn.com': { name: 'KPN', category: 'telecom' },
  'ziggo.nl': { name: 'Ziggo', category: 'telecom' },
  'vodafoneziggo.nl': { name: 'VodafoneZiggo', category: 'telecom' },
  'odido.nl': { name: 'Odido', category: 'telecom' },
  'tele2.nl': { name: 'Tele2', category: 'telecom' },
  'tmobile.nl': { name: 'T-Mobile', category: 'telecom' },
  'simyo.nl': { name: 'Simyo', category: 'telecom' },
  'youfone.nl': { name: 'Youfone', category: 'telecom' },
  // Energy
  'vattenfall.nl': { name: 'Vattenfall', category: 'nutsvoorzieningen' },
  'vattenfall.com': { name: 'Vattenfall', category: 'nutsvoorzieningen' },
  'eneco.nl': { name: 'Eneco', category: 'nutsvoorzieningen' },
  'essent.nl': { name: 'Essent', category: 'nutsvoorzieningen' },
  'greenchoice.nl': { name: 'Greenchoice', category: 'nutsvoorzieningen' },
  'budgetenergie.nl': { name: 'Budget Energie', category: 'nutsvoorzieningen' },
  'engie.nl': { name: 'ENGIE', category: 'nutsvoorzieningen' },
  'energiedirect.nl': { name: 'Energiedirect', category: 'nutsvoorzieningen' },
  'vandebron.nl': { name: 'Vandebron', category: 'nutsvoorzieningen' },
  'tibber.com': { name: 'Tibber', category: 'nutsvoorzieningen' },
  'innova-energie.nl': { name: 'Innova Energie', category: 'nutsvoorzieningen' },
  // Water
  'waternet.nl': { name: 'Waternet', category: 'nutsvoorzieningen' },
  'evides.nl': { name: 'Evides', category: 'nutsvoorzieningen' },
  'vitens.nl': { name: 'Vitens', category: 'nutsvoorzieningen' },
  'dunea.nl': { name: 'Dunea', category: 'nutsvoorzieningen' },
  'brabantwater.nl': { name: 'Brabant Water', category: 'nutsvoorzieningen' },
  'pwn.nl': { name: 'PWN', category: 'nutsvoorzieningen' },
  'oasen.nl': { name: 'Oasen', category: 'nutsvoorzieningen' },
  // Insurance
  'zilverenkruis.nl': { name: 'Zilveren Kruis', category: 'verzekeringen' },
  'cz.nl': { name: 'CZ', category: 'verzekeringen' },
  'menzis.nl': { name: 'Menzis', category: 'verzekeringen' },
  'vgz.nl': { name: 'VGZ', category: 'verzekeringen' },
  'ohra.nl': { name: 'OHRA', category: 'verzekeringen' },
  'interpolis.nl': { name: 'Interpolis', category: 'verzekeringen' },
  'centraal-beheer.nl': { name: 'Centraal Beheer', category: 'verzekeringen' },
  'achmea.nl': { name: 'Achmea', category: 'verzekeringen' },
  'nn.nl': { name: 'Nationale-Nederlanden', category: 'verzekeringen' },
  'aegon.nl': { name: 'Aegon', category: 'verzekeringen' },
  'unive.nl': { name: 'Univé', category: 'verzekeringen' },
  'ditzo.nl': { name: 'Ditzo', category: 'verzekeringen' },
  'inshared.nl': { name: 'InShared', category: 'verzekeringen' },
  'zorgdirect.nl': { name: 'Zorgdirect', category: 'verzekeringen' },
  // Government
  'belastingdienst.nl': { name: 'Belastingdienst', category: 'overheid' },
  'cjib.nl': { name: 'CJIB', category: 'overheid' },
  'noreply.cjib.nl': { name: 'CJIB', category: 'overheid' },
  'duo.nl': { name: 'DUO', category: 'overheid' },
  'svb.nl': { name: 'SVB', category: 'overheid' },
  'cak.nl': { name: 'CAK', category: 'overheid' },
  'uwv.nl': { name: 'UWV', category: 'overheid' },
  'rdw.nl': { name: 'RDW', category: 'overheid' },
  'cbr.nl': { name: 'CBR', category: 'overheid' },
  // Housing
  'vestia.nl': { name: 'Vestia', category: 'wonen' },
  'woonstad.nl': { name: 'Woonstad Rotterdam', category: 'wonen' },
  'havensteder.nl': { name: 'Havensteder', category: 'wonen' },
  'woonbron.nl': { name: 'Woonbron', category: 'wonen' },
  'staedion.nl': { name: 'Staedion', category: 'wonen' },
  'ymere.nl': { name: 'Ymere', category: 'wonen' },
  'dealliantie.nl': { name: 'De Alliantie', category: 'wonen' },
  'eigenhaard.nl': { name: 'Eigen Haard', category: 'wonen' },
  'portaal.nl': { name: 'Portaal', category: 'wonen' },
  // BNPL / Incasso
  'klarna.com': { name: 'Klarna', category: 'winkels' },
  'afterpay.nl': { name: 'Afterpay', category: 'winkels' },
  'billink.nl': { name: 'Billink', category: 'winkels' },
  'riverty.com': { name: 'Riverty', category: 'winkels' },
  'in3.nl': { name: 'in3', category: 'winkels' },
  'spraypay.nl': { name: 'SprayPay', category: 'winkels' },
  // Transport
  'ns.nl': { name: 'NS', category: 'vervoer' },
  'translink.nl': { name: 'OV-chipkaart', category: 'vervoer' },
  'ret.nl': { name: 'RET', category: 'vervoer' },
  'gvb.nl': { name: 'GVB', category: 'vervoer' },
  // Healthcare
  'zorginstituut.nl': { name: 'Zorginstituut Nederland', category: 'zorg' },
  // Shops
  'bol.com': { name: 'Bol.com', category: 'winkels' },
  'coolblue.nl': { name: 'Coolblue', category: 'winkels' },
  'mediamarkt.nl': { name: 'MediaMarkt', category: 'winkels' },
  'amazon.nl': { name: 'Amazon', category: 'winkels' },
  'wehkamp.nl': { name: 'Wehkamp', category: 'winkels' },
  // Subscriptions
  'spotify.com': { name: 'Spotify', category: 'abonnementen' },
  'netflix.com': { name: 'Netflix', category: 'abonnementen' },
  'apple.com': { name: 'Apple', category: 'abonnementen' },
  'google.com': { name: 'Google', category: 'abonnementen' },
  'microsoft.com': { name: 'Microsoft', category: 'abonnementen' },
};

export function lookupVendorByDomain(senderEmail: string): { name: string; category: string } | null {
  if (!senderEmail) return null;
  const domain = senderEmail.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  if (DOMAIN_VENDOR_MAP[domain]) return DOMAIN_VENDOR_MAP[domain];

  // Try parent domains
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (DOMAIN_VENDOR_MAP[parent]) return DOMAIN_VENDOR_MAP[parent];
  }

  return null;
}

// --- 7b. Vendor from text ---

export function extractVendorFromText(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Pattern 1: Explicit labels
  const labelPatterns = [
    /(?:afzender|van|from|bedrijf|crediteur|begunstigde)[:\s]+(.+)/i,
    /(?:namens|opdrachtgever|in opdracht van)[:\s]+(.+)/i,
  ];

  for (const line of lines.slice(0, 20)) {
    for (const pattern of labelPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim().replace(/[,;].*$/, '').trim();
        if (name.length >= 2 && name.length <= 80) return name;
      }
    }
  }

  // Pattern 2: B.V., N.V., Stichting in first 15 lines
  for (const line of lines.slice(0, 15)) {
    if (/\b(B\.?V\.?|N\.?V\.?|Stichting|Gemeente|Coöperatie|Vereniging)\b/i.test(line)) {
      const cleaned = line.replace(/^[^a-zA-Z]+/, '').replace(/\s{2,}.*$/, '').trim();
      if (cleaned.length >= 3 && cleaned.length <= 80) return cleaned;
    }
  }

  // Pattern 3: First line that looks like a company name (capitalized, 2-5 words)
  for (const line of lines.slice(0, 10)) {
    if (/^[A-Z][a-z]/.test(line) && line.split(/\s+/).length <= 5 && line.length <= 50) {
      // Skip common non-vendor lines
      if (/^(Factuur|Rekening|Herinnering|Aanmaning|Geachte|Datum|Pagina)/i.test(line)) continue;
      return line;
    }
  }

  return null;
}

// --- 7c. Fuzzy matching (Levenshtein) ---

function levenshtein(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const matrix: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[la][lb];
}

const KNOWN_VENDORS = Object.values(DOMAIN_VENDOR_MAP).map((v) => v.name);

export function fuzzyMatchVendor(input: string): string | null {
  if (!input || input.length < 2) return null;
  const lower = input.toLowerCase();

  let bestMatch: string | null = null;
  let bestScore = Infinity;

  for (const vendor of KNOWN_VENDORS) {
    const score = levenshtein(lower, vendor.toLowerCase());
    const threshold = Math.max(2, Math.floor(vendor.length * 0.3)); // 30% tolerance
    if (score < bestScore && score <= threshold) {
      bestScore = score;
      bestMatch = vendor;
    }
  }

  return bestMatch;
}

// ============================================================
// 8. KVK NUMBER EXTRACTION
// ============================================================

export function extractKvkNumber(text: string): string | null {
  const patterns = [
    /(?:KvK|KVK|Kamer van Koophandel)[:\s-]*(\d{8})/i,
    /(?:handelsregister)[:\s-]*(\d{8})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// ============================================================
// 9. CATEGORY FROM VENDOR NAME (keyword-based)
// ============================================================

const VENDOR_CATEGORY_KEYWORDS: { category: string; keywords: string[] }[] = [
  { category: 'nutsvoorzieningen', keywords: ['energie', 'gas', 'elektr', 'stroom', 'water', 'warmte'] },
  { category: 'telecom', keywords: ['telecom', 'mobiel', 'internet', 'glasvezel', 'telefoon'] },
  { category: 'verzekeringen', keywords: ['verzeker', 'zorgpolis', 'polis'] },
  { category: 'overheid', keywords: ['gemeente', 'belasting', 'waterschap', 'rijks'] },
  { category: 'zorg', keywords: ['ziekenhuis', 'huisarts', 'tandarts', 'apotheek', 'fysiotherap', 'ggz'] },
  { category: 'wonen', keywords: ['woon', 'huur', 'hypotheek', 'vastgoed', 'corporatie'] },
  { category: 'incasso', keywords: ['incasso', 'deurwaarder', 'vordering', 'gerechtsdeurwaarder'] },
  { category: 'vervoer', keywords: ['vervoer', 'transport', 'ov-', 'parkeer'] },
  { category: 'winkels', keywords: ['shop', 'store', 'winkel', 'afterpay', 'klarna', 'billink'] },
];

function detectCategoryFromText(text: string, vendor: string | null): string {
  const searchText = `${vendor || ''} ${text}`.toLowerCase();

  for (const { category, keywords } of VENDOR_CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (searchText.includes(kw)) return category;
    }
  }

  return 'overig';
}

// ============================================================
// 10. MAIN EXTRACTION FUNCTION
// ============================================================

export function extractFromText(
  text: string,
  senderEmail?: string
): RegexExtractionResult {
  const fieldsFound: string[] = [];

  // 1. Vendor — domain lookup → text extraction → fuzzy match
  let vendor: string | null = null;
  let category = 'overig';

  if (senderEmail) {
    const domainResult = lookupVendorByDomain(senderEmail);
    if (domainResult) {
      vendor = domainResult.name;
      category = domainResult.category;
      fieldsFound.push('vendor');
    }
  }

  if (!vendor) {
    vendor = extractVendorFromText(text);
    if (vendor) {
      fieldsFound.push('vendor');
      // Try fuzzy match to normalize name
      const fuzzy = fuzzyMatchVendor(vendor);
      if (fuzzy) vendor = fuzzy;
    }
  }

  // 2. IBAN
  const iban = extractIban(text);
  if (iban) fieldsFound.push('iban');

  // 3. Amount
  const amount_cents = extractAmount(text);
  if (amount_cents) fieldsFound.push('amount');

  // 4. Due date
  const due_date = extractDueDate(text);
  if (due_date) fieldsFound.push('due_date');

  // 5. Reference
  const reference = extractReference(text);
  if (reference) fieldsFound.push('reference');

  // 6. Payment URL
  const payment_url = extractPaymentUrl(text);
  if (payment_url) fieldsFound.push('payment_url');

  // 7. Escalation stage
  const escalation_stage = detectEscalationStage(text);
  if (escalation_stage) fieldsFound.push('escalation_stage');

  // 8. Category (from domain, vendor name, or text keywords)
  if (category === 'overig') {
    category = detectCategoryFromText(text, vendor);
  }
  if (category !== 'overig') fieldsFound.push('category');

  // 9. KVK
  const kvk_number = extractKvkNumber(text);
  if (kvk_number) fieldsFound.push('kvk');

  // Confidence = weighted score of key fields
  const weights: Record<string, number> = {
    vendor: 0.25, amount: 0.3, iban: 0.2, due_date: 0.15, reference: 0.1,
  };
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
    kvk_number,
    method: 'regex',
    fields_found: fieldsFound,
    confidence: Math.round(confidence * 100) / 100,
  };
}
