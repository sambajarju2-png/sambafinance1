import { logAiUsage } from './usage-log';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Call Gemini 2.5 Flash with a text prompt.
 * Uses lenient parsing — truncated JSON defaults to safe values.
 * SERVER-ONLY.
 */
export async function callGeminiText(
  prompt: string,
  userId: string,
  operation: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const startTime = Date.now();

  const response = await fetch(
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
      }),
    }
  );

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini API error:', response.status, '-', errText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokensIn = data.usageMetadata?.promptTokenCount || 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;

  await logAiUsage({
    userId, model: GEMINI_MODEL, operation, tokensIn, tokensOut,
    costCents: (tokensIn + tokensOut) * 0.00001, durationMs,
  });

  // Use lenient parsing — handles truncated JSON from Gemini
  return parseJsonResponseLenient(text);
}

/**
 * Call Gemini 2.5 Flash with an image for camera scan.
 * Uses lenient parsing — returns partial results instead of throwing.
 * SERVER-ONLY.
 */
export async function callGeminiVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  userId: string,
  operation: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const startTime = Date.now();

  const response = await fetch(
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    }
  );

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini Vision API error:', response.status, '-', errText);
    if (response.status === 400) {
      throw new Error('De foto kon niet worden verwerkt. Probeer een duidelijkere foto.');
    }
    throw new Error(`Gemini Vision API error: ${response.status}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate || candidate.finishReason === 'SAFETY') {
    throw new Error('De foto werd geblokkeerd. Probeer een andere foto.');
  }

  const text = candidate.content?.parts?.[0]?.text || '';
  if (!text.trim()) {
    throw new Error('Gemini kon geen tekst uit de foto halen. Probeer een duidelijkere foto.');
  }

  const tokensIn = data.usageMetadata?.promptTokenCount || 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;

  await logAiUsage({
    userId, model: `${GEMINI_MODEL}-vision`, operation, tokensIn, tokensOut,
    costCents: (tokensIn + tokensOut) * 0.00003, durationMs,
  });

  return parseJsonResponseLenient(text);
}

/**
 * Lenient JSON parse — handles truncated responses, broken JSON, markdown fences.
 * For classification: truncated `{"is_bill": false, "confidence": 0.9,` → extracts what it can.
 * For vision: extracts fields from raw text if JSON fails completely.
 */
function parseJsonResponseLenient(text: string): Record<string, unknown> {
  // Step 1: Clean markdown fences
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // Step 2: Find JSON boundaries
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Try fixing common issues
      const fixed = fixBrokenJson(jsonStr);
      if (fixed) {
        try { return JSON.parse(fixed); } catch { /* fall through */ }
      }
    }
  }

  // Step 3: JSON has no closing brace — try to close it
  if (start !== -1 && (end === -1 || end <= start)) {
    const partial = cleaned.slice(start);
    const repaired = repairTruncatedJson(partial);
    if (repaired) {
      try { return JSON.parse(repaired); } catch { /* fall through */ }
    }
  }

  // Step 4: Last resort — extract fields from raw text
  console.warn('JSON parse failed, extracting fields from text:', text.slice(0, 300));
  return extractFieldsFromText(text);
}

/**
 * Try to repair truncated JSON by closing open strings, arrays, objects.
 */
function repairTruncatedJson(partial: string): string | null {
  try {
    let fixed = partial;

    // Count open braces/brackets
    let braces = 0;
    let brackets = 0;
    let inString = false;
    let lastChar = '';

    for (let i = 0; i < fixed.length; i++) {
      const ch = fixed[i];
      if (ch === '"' && lastChar !== '\\') inString = !inString;
      if (!inString) {
        if (ch === '{') braces++;
        if (ch === '}') braces--;
        if (ch === '[') brackets++;
        if (ch === ']') brackets--;
      }
      lastChar = ch;
    }

    // Close open string
    if (inString) fixed += '"';

    // Remove trailing comma
    fixed = fixed.replace(/,\s*$/, '');

    // Close open brackets and braces
    for (let i = 0; i < brackets; i++) fixed += ']';
    for (let i = 0; i < braces; i++) fixed += '}';

    return fixed;
  } catch {
    return null;
  }
}

/**
 * Fix common JSON issues (trailing commas, single quotes).
 */
function fixBrokenJson(jsonStr: string): string | null {
  try {
    let fixed = jsonStr;
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    fixed = fixed.replace(/'/g, '"');
    return fixed;
  } catch {
    return null;
  }
}

/**
 * Last resort: extract known field values from raw AI text.
 */
function extractFieldsFromText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = { _parse_error: true };

  // Classification fields
  const isBillMatch = text.match(/"is_bill"\s*:\s*(true|false)/i);
  if (isBillMatch) result.is_bill = isBillMatch[1] === 'true';

  const confMatch = text.match(/"confidence"\s*:\s*([\d.]+)/);
  if (confMatch) result.confidence = parseFloat(confMatch[1]);

  const reasonMatch = text.match(/"reason"\s*:\s*"([^"]*)/);
  if (reasonMatch) result.reason = reasonMatch[1];

  // Extraction fields
  const vendorMatch = text.match(/"vendor"\s*:\s*"([^"]*)/i);
  if (vendorMatch) result.vendor = vendorMatch[1];

  const amountMatch = text.match(/"amount_cents"\s*:\s*(\d+)/i);
  if (amountMatch) result.amount_cents = parseInt(amountMatch[1]);

  const ibanMatch = text.match(/[A-Z]{2}\d{2}[A-Z]{4}\d{10}/);
  if (ibanMatch) result.iban = ibanMatch[0];

  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) result.due_date = dateMatch[1];

  const refMatch = text.match(/"reference"\s*:\s*"([^"]*)/i);
  if (refMatch) result.reference = refMatch[1];

  const stageMatch = text.match(/"escalation_stage"\s*:\s*"([^"]*)/i);
  if (stageMatch) result.escalation_stage = stageMatch[1];

  const categoryMatch = text.match(/"category_hint"\s*:\s*"([^"]*)/i);
  if (categoryMatch) result.category_hint = categoryMatch[1];

  return result;
}
