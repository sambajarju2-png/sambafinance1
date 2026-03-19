import { callGeminiText, callGeminiVision } from './gemini';
import { callHaiku } from './haiku';

/**
 * PayWatch Dual-AI Pipeline
 *
 * ALL AI calls go through this file. Routes never call Gemini or Haiku directly.
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
const CATEGORY_HINT_LIST = 'wonen|nutsvoorzieningen|zorg|verzekeringen|telecom|overheid|vervoer|leningen|winkels|abonnementen|gezin|zakelijk|incasso_kosten|overig';

// ============================================================
// 1. EMAIL CLASSIFICATION (Gemini)
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

  const result = await callGeminiText(prompt, userId, 'email_classification');

  // If parsing failed completely, default to not-a-bill (safe default)
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
// 2. EMAIL BILL EXTRACTION (Haiku)
// ============================================================

const EXTRACTION_PROMPT = `You are extracting structured data from a Dutch bill/invoice email.
Extract all available fields. If a field is not found, set it to null.
Detect the debt collection stage if applicable.
All monetary amounts must be in CENTS (integer). €127.43 = 12743.

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
  const pdfNote = pdfText
    ? `PDF attachment content:\n${pdfText.slice(0, 3000)}`
    : 'No PDF attachment.';

  const prompt = EXTRACTION_PROMPT
    .replace('{subject}', subject)
    .replace('{body}', body.slice(0, 3000))
    .replace('{pdf_note}', pdfNote);

  const result = await callHaiku(prompt, userId, 'email_extraction', 1024);

  return normalizeExtraction(result);
}

// ============================================================
// 3. CAMERA BILL EXTRACTION (Gemini Vision)
// ============================================================

const CAMERA_PROMPT = `You are analyzing a photo of a Dutch bill, invoice, or collection letter.
Extract all visible fields. If a field is not clearly visible, set to null.
All monetary amounts must be in CENTS (integer). €127.43 = 12743.

Detect the type:
- Regular invoice (factuur)
- Payment reminder (herinnering)
- Formal notice (aanmaning)
- Collection agency letter (incasso)
- Bailiff notice (deurwaarder)

Output format:
{
  "vendor": "string",
  "amount_cents": integer,
  "currency": "EUR",
  "iban": "string | null",
  "reference": "string | null",
  "due_date": "YYYY-MM-DD | null",
  "category_hint": "string (${CATEGORY_HINT_LIST})",
  "escalation_stage": "factuur|herinnering|aanmaning|incasso|deurwaarder|null",
  "payment_url": "string | null",
  "confidence": {"vendor": 0.0-1.0, "amount": 0.0-1.0, "due_date": 0.0-1.0}
}

IMPORTANT: Respond ONLY with valid JSON. No markdown. No code fences. No explanation.
Start with { and end with }.`;

export async function extractBillFromPhoto(
  imageBase64: string,
  mimeType: string,
  userId: string
): Promise<CameraExtractionResult> {
  // callGeminiVision now uses lenient parsing — it returns partial results
  // instead of throwing when JSON is incomplete. So we always get something.
  const result = await callGeminiVision(
    imageBase64,
    mimeType,
    CAMERA_PROMPT,
    userId,
    'camera_extraction'
  );

  // If _parse_error is set, we got a partial extraction from raw text.
  // That's fine — fill in what we have, leave the rest for the user.
  const wasPartial = Boolean(result._parse_error);

  return {
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
}

// ============================================================
// 4. AI INSIGHTS (Haiku)
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
// 5. DRAFT LETTER (Haiku)
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

  // Use 1024 tokens — 384 was too small and caused truncated JSON
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
