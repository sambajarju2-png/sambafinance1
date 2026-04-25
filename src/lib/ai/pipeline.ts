import { callMistralText, callMistralVision } from './mistral';
import { callHaiku, callSonnet } from './haiku';
import { buildExtractionPrompt } from './prompts';
import { buildCorrectionPrompt } from '../ai-corrections';
import { createServerSupabaseClient } from '../supabase/server';
import { detectIncassoAgency } from '../incasso-detect';
import { lookupVendor, buildVendorContext } from '../vendor-lookup';
import { regexExtract, needsAiFallback } from '../regex-extractor';

/**
 * PayWatch Dual-AI Pipeline
 *
 * ALL AI calls go through this file. Routes never call AI directly.
 *
 * Architecture:
 * - Mistral Small 3.2 (Scaleway EU): email classification (is this a bill? yes/no)
 * - Claude Sonnet: email extraction (reliable JSON, deep Dutch understanding)
 * - Claude Haiku: insights + draft letters (cheaper, good enough)
 * - Mistral Small 3.2 Vision (Scaleway EU): camera scan extraction
 * - Database handles categorization (561 known vendors + incasso agencies)
 *
 * SERVER-ONLY — never import in client components.
 */

// ============================================================
// TYPES
// ============================================================

export interface ClassificationResult {
  is_bill: boolean;
  confidence: number;
  reason: string;
}

export interface BillExtractionResult {
  vendor: string;
  amount_cents: number;
  currency: string;
  iban: string | null;
  reference: string | null;
  due_date: string | null;
  received_date: string;
  category_hint: string;
  is_reminder: boolean;
  escalation_stage: string | null;
  payment_url: string | null;
  vendor_contact: {
    email: string | null;
    phone: string | null;
    website: string | null;
  };
  estimated_extra_costs_cents: number | null;
  confidence: {
    vendor: number;
    amount: number;
    due_date: number;
  };
}

export interface CameraExtractionResult {
  vendor: string;
  amount_cents: number;
  currency: string;
  iban: string | null;
  reference: string | null;
  due_date: string | null;
  category_hint: string;
  escalation_stage: string | null;
  payment_url: string | null;
  confidence: {
    vendor: number;
    amount: number;
    due_date: number;
  };
}

export interface DraftLetterResult {
  subject: string;
  body: string;
}

export interface InsightResult {
  insights: Array<{
    type: 'priority' | 'warning' | 'pattern' | 'tip';
    title: string;
    description: string;
    bill_id: string | null;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  }>;
  summary: string;
}

// Category list for AI prompts
const CATEGORY_HINT_LIST = 'wonen|nutsvoorzieningen|zorg|verzekeringen|telecom|overheid|vervoer|leningen|winkels|abonnementen|gezin|zakelijk|incasso|overig';

// ============================================================
// 1. EMAIL CLASSIFICATION (Mistral)
// ============================================================

const CLASSIFICATION_PROMPT = `You are analyzing an email to determine if it contains a bill, invoice, or payment request. Consider the subject, sender, and body content.

Rules:
- A bill/invoice contains: an amount to pay, a due date, or payment instructions
- Reminders and collection notices (aanmaning, incasso) are bills
- Marketing emails, newsletters, and promotions are NOT bills
- Order confirmations without payment requests are NOT bills
- Shipping notifications are NOT bills
- Password reset emails are NOT bills
- Social media notifications are NOT bills

Email subject: {subject}
Email sender: {sender}
Email body (first 500 chars): {body}

Respond with ONLY a JSON object:
{"is_bill": true/false, "confidence": 0.0-1.0, "reason": "one sentence"}
Start with { and end with }.`;

export async function classifyEmail(
  subject: string,
  sender: string,
  body: string,
  userId: string
): Promise<ClassificationResult> {
  const prompt = CLASSIFICATION_PROMPT
    .replace('{subject}', subject)
    .replace('{sender}', sender)
    .replace('{body}', body.slice(0, 500));

  const result = await callMistralText(prompt, userId, 'email_classification');

  if (result._parse_error && result.is_bill === undefined) {
    console.warn('Classification parse error, defaulting to not-a-bill for:', subject.slice(0, 60));
    return { is_bill: false, confidence: 0, reason: 'Parse error — skipped' };
  }

  return {
    is_bill: Boolean(result.is_bill),
    confidence: Number(result.confidence) || 0,
    reason: String(result.reason || ''),
  };
}

// ============================================================
// 2. EMAIL BILL EXTRACTION (Mistral — EU-hosted via Scaleway)
//
// Mistral handles structured Dutch extraction well with JSON mode.
// All bill data stays in EU (Paris). Cheaper than Sonnet and prevents
// data from leaving Europe.
// ============================================================

const EXTRACTION_PROMPT = `You are extracting structured data from a Dutch bill/invoice email.
Extract all available fields. If a field is not found, set it to null.
Detect the debt collection stage if applicable.
All monetary amounts must be in CENTS (integer). Dutch format: dots are thousands separators, comma is decimal.

AMOUNT PARSING (CRITICAL — Dutch format):
- € 1.234,56 = 123456 cents (dot = thousands, comma = decimal)
- € 127,43 = 12743 cents
- € 15,- = 1500 cents (dash means zero cents)
- € 15 = 1500 cents (no decimals = whole euros)
- € 0,75 = 75 cents
- € 1234 = 123400 cents (no separator = whole euros)
- WRONG: € 1.234,56 ≠ 1234.56 (that is English format, not Dutch)

CRITICAL RULES:
- "Te betalen" or "Totaal te betalen" is ALWAYS the correct amount. Not subtotals.
- Use the IBAN under "Betaalinformatie" or "Overmaken naar", not header/footer IBANs.
- If "Opdrachtgever" is listed, vendor = "[Bureau] (namens [Opdrachtgever])"
- "Betalingskenmerk" > "Dossiernummer" > "Factuurnummer" for reference
- For betalingsregeling: use "NOG TE BETALEN" (current term) and first future Vervaldatum

CATEGORY RULES (pick the most specific one):
- wonen: huur, hypotheek, servicekosten, VvE bijdrage, woningcorporatie
- nutsvoorzieningen: gas, elektriciteit, water, stadsverwarming, energiecontract
- zorg: huisarts, tandarts, ziekenhuis, apotheek, GGZ, fysiotherapie, eigen risico
- verzekeringen: zorgverzekering, autoverzekering, inboedel, aansprakelijkheid, WA, opstal
- telecom: telefoon, internet, TV, mobiel abonnement, glasvezel
- overheid: CJIB, Belastingdienst, DUO studieschuld, gemeente belasting, waterschap, CAK, SVB
- vervoer: OV, NS, auto-onderhoud, RDW, parkeerboete, wegenbelasting, ANWB
- leningen: persoonlijke lening, doorlopend krediet, studiefinanciering, hypotheek aflossing
- incasso: incassobureau, deurwaarder, collection agency, vordering namens
- winkels: webshop, Afterpay, Klarna, Billink, buy now pay later
- abonnementen: streaming, sportschool, software, tijdschrift, lidmaatschap
- gezin: kinderopvang, school, BSO, sportvereniging
- zakelijk: zakelijke dienstverlening, boekhouder, KvK
- overig: anything that does not fit above

{vendor_context}

Email subject: {subject}
Email body:
{body}

{pdf_note}

Output format:
{
  "vendor": "string",
  "amount_cents": integer,
  "currency": "EUR",
  "iban": "string | null",
  "reference": "string | null",
  "due_date": "YYYY-MM-DD | null",
  "received_date": "YYYY-MM-DD",
  "category_hint": "string (${CATEGORY_HINT_LIST})",
  "is_reminder": boolean,
  "escalation_stage": "factuur|herinnering|aanmaning|incasso|deurwaarder|null",
  "payment_url": "string | null",
  "vendor_contact": {"email": null, "phone": null, "website": null},
  "estimated_extra_costs_cents": integer | null,
  "confidence": {"vendor": 0.0-1.0, "amount": 0.0-1.0, "due_date": 0.0-1.0}
}

Respond ONLY with valid JSON. No markdown. No explanation.
Start with { and end with }.`;

export async function extractBillFromEmail(
  subject: string,
  body: string,
  pdfText: string | null,
  userId: string
): Promise<BillExtractionResult> {
  // ── LAYER 0: Regex pre-extraction (free, <5ms) ──
  // Try deterministic extraction first. If high confidence → skip AI.
  const fullText = [subject, body, pdfText || ''].join('\n');
  const regexResult = regexExtract(fullText);

  console.log(
    `[Regex] ${regexResult.fields_found.length} fields extracted (${regexResult.fields_found.join(', ')}), ` +
    `${6 - regexResult.fields_found.length} missing, confidence: ${regexResult.confidence}, ` +
    `needs AI: ${needsAiFallback(regexResult)}`
  );

  // ── AI EXTRACTION (Sonnet — only when regex can't handle it) ──
  const pdfNote = pdfText
    ? `PDF attachment content:\n${pdfText.slice(0, 3000)}`
    : 'No PDF attachment.';

  // Build vendor context for Sonnet (handles long context well)
  let vendorContext = '';
  try {
    vendorContext = await buildVendorContext();
  } catch {
    // Non-critical
  }

  const prompt = EXTRACTION_PROMPT
    .replace('{subject}', subject)
    .replace('{body}', body.slice(0, 3000))
    .replace('{pdf_note}', pdfNote)
    .replace('{vendor_context}', vendorContext);

  // Use Mistral (Scaleway EU) for extraction — all bill data stays in Europe
  const result = await callMistralText(prompt, userId, 'email_extraction');

  const extracted = normalizeExtraction(result);

  // ── MERGE: Use regex results to validate/override AI where regex is confident ──
  if (regexResult.amount_cents) {
    // Trust regex amount over AI (regex handles Dutch format perfectly)
    extracted.amount_cents = regexResult.amount_cents;
  }
  if (regexResult.iban) {
    // Trust regex IBAN (MOD-97 validated)
    extracted.iban = regexResult.iban;
  }
  if (regexResult.due_date) {
    extracted.due_date = regexResult.due_date;
  }
  if (regexResult.reference) {
    extracted.reference = regexResult.reference;
  }
  if (regexResult.escalation_stage) {
    extracted.escalation_stage = regexResult.escalation_stage;
  }
  if (regexResult.payment_url && !extracted.payment_url) {
    extracted.payment_url = regexResult.payment_url;
  }

  // Post-AI: DB handles categorization (instant, free, more accurate than AI)
  const vendorMatch = await lookupVendor(extracted.vendor);
  if (vendorMatch.matched && vendorMatch.category) {
    extracted.category_hint = vendorMatch.category;
    if (vendorMatch.display_name) extracted.vendor = vendorMatch.display_name;
    if (vendorMatch.suggested_escalation) {
      extracted.escalation_stage = extracted.escalation_stage || vendorMatch.suggested_escalation;
    }
  }

  // Post-AI: Check Justis Incasso Register (270 agencies)
  if (!vendorMatch.is_incasso) {
    const incassoCheck = await detectIncassoAgency(extracted.vendor);
    if (incassoCheck.matched) {
      extracted.category_hint = 'incasso';
      extracted.escalation_stage = extracted.escalation_stage || incassoCheck.suggested_escalation;
      if (incassoCheck.agency_name) extracted.vendor = incassoCheck.agency_name;
    }
  }

  return extracted;
}

// ============================================================
// 3. CAMERA BILL EXTRACTION (Mistral Vision)
// 
// NO vendor context here — Mistral handles classification only.
// Sending 291 vendor names DILUTES extraction quality.
// Let Mistral focus 100% on reading the image.
// Category + escalation are handled AFTER by DB lookup.
// ============================================================

export async function extractBillFromPhoto(
  imageBase64: string,
  mimeType: string,
  userId: string
): Promise<CameraExtractionResult> {
  // Fetch active correction patterns from DB (learned from user edits)
  let correctionRules = '';
  try {
    const supabase = await createServerSupabaseClient();
    correctionRules = await buildCorrectionPrompt(supabase);
  } catch {
    // Non-critical — continue without correction patterns
  }

  // Build prompt with Dutch rules + corrections ONLY (no vendor context)
  const prompt = buildExtractionPrompt(correctionRules);

  const result = await callMistralVision(
    imageBase64,
    mimeType,
    prompt,
    userId,
    'camera_extraction'
  );

  const wasPartial = Boolean(result._parse_error);

  const extracted: CameraExtractionResult = {
    vendor: String(result.vendor || ''),
    amount_cents: Number(result.amount_cents) || 0,
    currency: String(result.currency || 'EUR'),
    iban: result.iban ? String(result.iban) : null,
    reference: result.reference ? String(result.reference) : null,
    due_date: result.due_date ? String(result.due_date) : null,
    category_hint: String(result.category_hint || 'overig'),
    escalation_stage: result.escalation_stage ? String(result.escalation_stage) : null,
    payment_url: result.payment_url ? String(result.payment_url) : null,
    confidence: wasPartial
      ? { vendor: 0.3, amount: 0.3, due_date: 0.1 }
      : {
          vendor: Number((result.confidence as Record<string, unknown>)?.vendor) || 0,
          amount: Number((result.confidence as Record<string, unknown>)?.amount) || 0,
          due_date: Number((result.confidence as Record<string, unknown>)?.due_date) || 0,
        },
  };

  // Post-AI: DB handles categorization (instant, free, overrides AI)
  const vendorMatch = await lookupVendor(extracted.vendor);
  if (vendorMatch.matched && vendorMatch.category) {
    extracted.category_hint = vendorMatch.category;
    if (vendorMatch.display_name) extracted.vendor = vendorMatch.display_name;
    if (vendorMatch.suggested_escalation) {
      extracted.escalation_stage = extracted.escalation_stage || vendorMatch.suggested_escalation;
    }
  }

  // Post-AI: Check Justis Incasso Register
  if (!vendorMatch.is_incasso) {
    const incassoCheck = await detectIncassoAgency(extracted.vendor);
    if (incassoCheck.matched) {
      extracted.category_hint = 'incasso';
      extracted.escalation_stage = extracted.escalation_stage || incassoCheck.suggested_escalation;
      if (incassoCheck.agency_name) extracted.vendor = incassoCheck.agency_name;
    }
  }

  return extracted;
}

// ============================================================
// 4. AI INSIGHTS (Haiku — cheaper, good enough for analysis)
// ============================================================

const INSIGHT_PROMPT = `You are a Dutch financial assistant analyzing a user's bills.
Provide 2-4 actionable insights based on the bill data below.
Focus on: payment priority (escalation risk), cost warnings (WIK), and spending patterns.

IMPORTANT: All amounts are in EUROS (e.g. 374.92 means €374.92). Do NOT misread decimals.

User's bills (JSON):
{bills_json}

User language: {language}

Output format:
{
  "insights": [
    {
      "type": "priority|warning|pattern|tip",
      "title": "short title in {language}",
      "description": "1-2 sentence explanation in {language}",
      "bill_id": "string|null",
      "urgency": "low|medium|high|critical"
    }
  ],
  "summary": "one sentence summary of overall financial health in {language}"
}

Respond ONLY with valid JSON. No markdown. Start with { and end with }.`;

export async function generateInsight(
  bills: Array<Record<string, unknown>>,
  userId: string,
  language: string = 'nl'
): Promise<InsightResult> {
  const billsSummary = bills.map((b) => ({
    id: b.id,
    vendor: b.vendor,
    amount_euros: Number(b.amount) ? (Number(b.amount) / 100).toFixed(2) : '0.00',
    due_date: b.due_date,
    status: b.status,
    escalation_stage: b.escalation_stage,
    category: b.category,
  }));

  const prompt = INSIGHT_PROMPT
    .replace('{bills_json}', JSON.stringify(billsSummary))
    .replaceAll('{language}', language === 'nl' ? 'Dutch' : 'English');

  const result = await callHaiku(prompt, userId, 'insights', 1024);

  const insights = Array.isArray(result.insights)
    ? (result.insights as Array<Record<string, unknown>>).map((i) => ({
        type: String(i.type || 'tip') as 'priority' | 'warning' | 'pattern' | 'tip',
        title: String(i.title || ''),
        description: String(i.description || ''),
        bill_id: i.bill_id ? String(i.bill_id) : null,
        urgency: String(i.urgency || 'low') as 'low' | 'medium' | 'high' | 'critical',
      }))
    : [];

  return {
    insights,
    summary: String(result.summary || ''),
  };
}

// ============================================================
// 5. DRAFT LETTER (Haiku — cheaper, good enough for text gen)
// ============================================================

const LETTER_PROMPT = `Draft a formal {language_name} letter from a consumer to {vendor}.
Bill reference: {reference}
Amount: €{amount}
Current stage: {escalation_stage}
User intent: {intent}
{details}

Rules:
- Professional, diplomatic {language_name}
- Reference the bill number and amount
- If betalingsregeling: propose monthly installments as specified
- If bezwaar: state grounds clearly
- If uitstel: request specific postponement
- If bevestiging: state payment was made on the specified date
- Include relevant WIK law references if stage >= aanmaning
- Keep under 250 words
- Include today's date: {today}
- At the bottom of the letter, add the sender's full name: {sender_name}
- Below the name, add date of birth: {sender_dob}
- Use date format DD-MM-YYYY for dates (e.g. 01-03-2026)

Return JSON: {"subject": "string", "body": "string"}
Start with { and end with }.`;

export async function generateDraftLetter(
  bill: {
    vendor: string;
    amount: number;
    reference: string | null;
    escalation_stage: string;
  },
  intent: string,
  details: string,
  language: string,
  userId: string,
  senderName: string = '',
  senderDob: string = ''
): Promise<DraftLetterResult> {
  const today = new Date().toISOString().split('T')[0];
  const amountEur = (bill.amount / 100).toFixed(2);
  const langName = language === 'nl' ? 'Dutch' : 'English';

  const prompt = LETTER_PROMPT
    .replaceAll('{language_name}', langName)
    .replace('{vendor}', bill.vendor)
    .replace('{reference}', bill.reference || 'N/A')
    .replace('{amount}', amountEur)
    .replace('{escalation_stage}', bill.escalation_stage)
    .replace('{intent}', intent)
    .replace('{details}', details)
    .replace('{today}', today)
    .replace('{sender_name}', senderName || 'N/A')
    .replace('{sender_dob}', senderDob || 'N/A');

  const result = await callHaiku(prompt, userId, 'draft_letter', 1024);

  return {
    subject: String(result.subject || ''),
    body: String(result.body || ''),
  };
}

// ============================================================
// HELPERS
// ============================================================

function normalizeExtraction(result: Record<string, unknown>): BillExtractionResult {
  const confidence = (result.confidence || {}) as Record<string, unknown>;
  const vendorContact = (result.vendor_contact || {}) as Record<string, unknown>;

  return {
    vendor: String(result.vendor || 'Onbekend'),
    amount_cents: Number(result.amount_cents) || 0,
    currency: String(result.currency || 'EUR'),
    iban: result.iban ? String(result.iban) : null,
    reference: result.reference ? String(result.reference) : null,
    due_date: result.due_date ? String(result.due_date) : null,
    received_date: String(result.received_date || new Date().toISOString().split('T')[0]),
    category_hint: String(result.category_hint || 'overig'),
    is_reminder: Boolean(result.is_reminder),
    escalation_stage: result.escalation_stage ? String(result.escalation_stage) : null,
    payment_url: result.payment_url ? String(result.payment_url) : null,
    vendor_contact: {
      email: vendorContact.email ? String(vendorContact.email) : null,
      phone: vendorContact.phone ? String(vendorContact.phone) : null,
      website: vendorContact.website ? String(vendorContact.website) : null,
    },
    estimated_extra_costs_cents: result.estimated_extra_costs_cents
      ? Number(result.estimated_extra_costs_cents)
      : null,
    confidence: {
      vendor: Number(confidence.vendor) || 0,
      amount: Number(confidence.amount) || 0,
      due_date: Number(confidence.due_date) || 0,
    },
  };
}
