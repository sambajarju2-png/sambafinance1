import { logAiUsage } from './usage-log';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Call Gemini 2.0 Flash with a text prompt.
 * Returns the parsed JSON response.
 *
 * SERVER-ONLY — never import in client components.
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

  const response = await fetch(
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
        },
      }),
    }
  );

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini API error:', response.status, errText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract text from Gemini response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokensIn = data.usageMetadata?.promptTokenCount || 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;

  // Log usage
  await logAiUsage({
    userId,
    model: GEMINI_MODEL,
    operation,
    tokensIn,
    tokensOut,
    costCents: (tokensIn + tokensOut) * 0.00001, // rough estimate
    durationMs,
  });

  // Parse JSON from response
  return parseJsonResponse(text);
}

/**
 * Call Gemini 2.0 Flash with an image (base64) for camera scan extraction.
 * Returns the parsed JSON response.
 *
 * SERVER-ONLY — never import in client components.
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

  const response = await fetch(
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini Vision API error:', response.status, errText);
    throw new Error(`Gemini Vision API error: ${response.status}`);
  }

  const data = await response.json();

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokensIn = data.usageMetadata?.promptTokenCount || 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;

  await logAiUsage({
    userId,
    model: `${GEMINI_MODEL}-vision`,
    operation,
    tokensIn,
    tokensOut,
    costCents: (tokensIn + tokensOut) * 0.00003, // vision is slightly more expensive
    durationMs,
  });

  return parseJsonResponse(text);
}

/**
 * Parse a JSON response from AI, handling markdown code fences and whitespace.
 */
function parseJsonResponse(text: string): Record<string, unknown> {
  // Remove markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Find the first { and last } to extract JSON
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    console.error('No valid JSON found in AI response:', text.slice(0, 200));
    throw new Error('AI response did not contain valid JSON');
  }

  const jsonStr = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Failed to parse AI JSON:', jsonStr.slice(0, 200));
    throw new Error('AI response contained invalid JSON');
  }
}
