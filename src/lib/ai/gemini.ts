import { logAiUsage } from './usage-log';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Call Gemini with a text prompt.
 */
export async function callGeminiText(
  prompt: string,
  userId: string,
  operation: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const startTime = Date.now();
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
    }),
  });

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Gemini text API error [${response.status}]:`, errText.slice(0, 500));
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokensIn = data.usageMetadata?.promptTokenCount || 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;

  await logAiUsage({ userId, model: GEMINI_MODEL, operation, tokensIn, tokensOut, costCents: (tokensIn + tokensOut) * 0.00001, durationMs });

  return parseJsonResponse(text);
}

/**
 * Call Gemini with an image for camera scan extraction.
 */
export async function callGeminiVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  userId: string,
  operation: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const startTime = Date.now();
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  console.log(`[Gemini Vision] Calling ${GEMINI_MODEL}, image size: ${Math.round(imageBase64.length / 1024)}KB, mime: ${mimeType}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  });

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Gemini Vision API error [${response.status}]:`, errText.slice(0, 500));
    throw new Error(`Gemini Vision API error: ${response.status} - ${errText.slice(0, 200)}`);
  }

  const data = await response.json();

  // Check for blocked or empty response
  if (!data.candidates || data.candidates.length === 0) {
    console.error('Gemini Vision returned no candidates:', JSON.stringify(data).slice(0, 500));
    throw new Error('Gemini returned no response. The image may be unclear.');
  }

  const candidate = data.candidates[0];
  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Image was blocked by safety filters. Try a different photo.');
  }

  const text = candidate.content?.parts?.[0]?.text || '';
  if (!text) {
    console.error('Gemini Vision returned empty text:', JSON.stringify(candidate).slice(0, 500));
    throw new Error('Gemini could not read the image. Try a clearer photo.');
  }

  console.log(`[Gemini Vision] Response (${text.length} chars):`, text.slice(0, 200));

  const tokensIn = data.usageMetadata?.promptTokenCount || 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;

  await logAiUsage({ userId, model: `${GEMINI_MODEL}-vision`, operation, tokensIn, tokensOut, costCents: (tokensIn + tokensOut) * 0.00003, durationMs });

  return parseJsonResponse(text);
}

/**
 * Parse JSON from AI response — handles markdown fences, whitespace, nested objects.
 */
function parseJsonResponse(text: string): Record<string, unknown> {
  let cleaned = text.trim();

  // Remove markdown code fences
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // Find JSON object boundaries
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    console.error('No valid JSON found in AI response:', text.slice(0, 300));
    // Try to return a minimal valid object instead of throwing
    return { error: 'No JSON in response', raw: text.slice(0, 200) };
  }

  const jsonStr = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Failed to parse AI JSON:', jsonStr.slice(0, 300));
    // Try fixing common issues
    try {
      // Sometimes AI outputs single quotes or trailing commas
      const fixed = jsonStr
        .replace(/'/g, '"')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      return JSON.parse(fixed);
    } catch {
      return { error: 'Invalid JSON', raw: jsonStr.slice(0, 200) };
    }
  }
}
