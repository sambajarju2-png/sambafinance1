import { logAiUsage } from './usage-log';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Call Gemini 2.5 Flash with a text prompt.
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

  return parseJsonResponse(text);
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

  // Use lenient parsing for vision — extract what we can
  return parseJsonResponseLenient(text);
}

/**
 * Strict JSON parse — throws on failure. Used for text classification.
 */
function parseJsonResponse(text: string): Record<string, unknown> {
  const jsonStr = extractJsonString(text);
  if (!jsonStr) {
    console.error('No valid JSON found in AI response:', text.slice(0, 300));
    throw new Error('AI response did not contain valid JSON');
  }
  try {
    return JSON.parse(jsonStr);
  } catch {
    console.error('Failed to parse AI JSON:', jsonStr.slice(0, 300));
    throw new Error('AI response contained invalid JSON');
  }
}

/**
 * Lenient JSON parse — tries hard to extract data, returns partial results
 * with _parse_error flag instead of throwing.
 */
function parseJsonResponseLenient(text: string): Record<string, unknown> {
  // First try normal parsing
  const jsonStr = extractJsonString(text);
  if (jsonStr) {
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Try fixing common JSON issues
      const fixed = fixBrokenJson(jsonStr);
      if (fixed) {
        try {
          return JSON.parse(fixed);
        } catch {
          // Fall through to text extraction
        }
      }
    }
  }

  // JSON parsing failed — try to extract fields from raw text
  console.warn('JSON parse failed, extracting fields from text:', text.slice(0, 300));
  return extractFieldsFromText(text);
}

/**
 * Extract the JSON substring from AI response text.
 */
function extractJsonString(text: string): string | null {
  let cleaned = text.trim();

  // Remove markdown code fences
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

/**
 * Try to fix common JSON issues (trailing commas, missing quotes).
 */
function fixBrokenJson(jsonStr: string): string | null {
  try {
    // Remove trailing commas before } or ]
    let fixed = jsonStr.replace(/,\s*([}\]])/g, '$1');
    // Replace single quotes with double quotes
    fixed = fixed.replace(/'/g, '"');
    return fixed;
  } catch {
    return null;
  }
}

/**
 * Last resort: extract known field values from raw AI text.
 * Returns a partial result object.
 */
function extractFieldsFromText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = { _parse_error: true };

  // Try to find vendor name
  const vendorMatch = text.match(/vendor["\s:]+([^",\n]+)/i) ||
                      text.match(/afzender["\s:]+([^",\n]+)/i) ||
                      text.match(/van["\s:]+([^",\n]+)/i);
  if (vendorMatch) result.vendor = vendorMatch[1].trim().replace(/["\s]+$/, '');

  // Try to find amount
  const amountMatch = text.match(/amount_cents["\s:]+(\d+)/i) ||
                      text.match(/€\s*(\d+[.,]\d{2})/);
  if (amountMatch) {
    if (amountMatch[0].includes('€')) {
      result.amount_cents = Math.round(parseFloat(amountMatch[1].replace(',', '.')) * 100);
    } else {
      result.amount_cents = parseInt(amountMatch[1]);
    }
  }

  // Try to find IBAN
  const ibanMatch = text.match(/[A-Z]{2}\d{2}[A-Z]{4}\d{10}/);
  if (ibanMatch) result.iban = ibanMatch[0];

  // Try to find due date
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) result.due_date = dateMatch[1];

  // Try to find reference
  const refMatch = text.match(/reference["\s:]+([^",\n]+)/i) ||
                   text.match(/kenmerk["\s:]+([^",\n]+)/i);
  if (refMatch) result.reference = refMatch[1].trim().replace(/["\s]+$/, '');

  // Try to find escalation stage
  const stageKeywords: Record<string, string> = {
    deurwaarder: 'deurwaarder', gerechtsdeurwaarder: 'deurwaarder',
    incasso: 'incasso', incassobureau: 'incasso',
    aanmaning: 'aanmaning', sommatie: 'aanmaning',
    herinnering: 'herinnering',
  };
  const lowerText = text.toLowerCase();
  for (const [keyword, stage] of Object.entries(stageKeywords)) {
    if (lowerText.includes(keyword)) {
      result.escalation_stage = stage;
      break;
    }
  }

  return result;
}
