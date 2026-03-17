import { logAiUsage } from './usage-log';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Call Claude Haiku for deep extraction, insights, or draft letters.
 * Returns the parsed JSON response.
 *
 * SERVER-ONLY — never import in client components.
 */
export async function callHaiku(
  prompt: string,
  userId: string,
  operation: string,
  maxTokens: number = 1024
): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const startTime = Date.now();

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.error('Haiku API error:', response.status, errText);
    throw new Error(`Haiku API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract text from Haiku response
  const text = data.content?.[0]?.text || '';
  const tokensIn = data.usage?.input_tokens || 0;
  const tokensOut = data.usage?.output_tokens || 0;

  // Haiku pricing: $0.80/MTok input, $4/MTok output (approx)
  const costCents =
    (tokensIn / 1_000_000) * 80 + (tokensOut / 1_000_000) * 400;

  await logAiUsage({
    userId,
    model: HAIKU_MODEL,
    operation,
    tokensIn,
    tokensOut,
    costCents,
    durationMs,
  });

  // Parse JSON from response
  return parseJsonResponse(text);
}

/**
 * Parse a JSON response from AI, handling markdown code fences and whitespace.
 */
function parseJsonResponse(text: string): Record<string, unknown> {
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

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    console.error('No valid JSON found in Haiku response:', text.slice(0, 200));
    throw new Error('Haiku response did not contain valid JSON');
  }

  const jsonStr = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Failed to parse Haiku JSON:', jsonStr.slice(0, 200));
    throw new Error('Haiku response contained invalid JSON');
  }
}
