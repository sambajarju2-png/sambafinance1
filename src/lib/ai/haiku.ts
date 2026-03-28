import { logAiUsage } from './usage-log';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Call Claude Haiku for insights and draft letters (cheaper tasks).
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
  return callAnthropic(HAIKU_MODEL, prompt, userId, operation, maxTokens, {
    inputCostPerMTok: 80,
    outputCostPerMTok: 400,
  });
}

/**
 * Call Claude Sonnet for deep extraction (more reliable JSON, better Dutch understanding).
 * Used for email bill extraction where JSON parse failures were causing missed bills.
 *
 * SERVER-ONLY — never import in client components.
 */
export async function callSonnet(
  prompt: string,
  userId: string,
  operation: string,
  maxTokens: number = 1024
): Promise<Record<string, unknown>> {
  return callAnthropic(SONNET_MODEL, prompt, userId, operation, maxTokens, {
    inputCostPerMTok: 300,
    outputCostPerMTok: 1500,
  });
}

/**
 * Shared Anthropic API caller for both Haiku and Sonnet.
 */
async function callAnthropic(
  model: string,
  prompt: string,
  userId: string,
  operation: string,
  maxTokens: number,
  pricing: { inputCostPerMTok: number; outputCostPerMTok: number }
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
      model,
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
    console.error(`${model} API error:`, response.status, errText);
    throw new Error(`${model} API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract text from response
  const text = data.content?.[0]?.text || '';
  const tokensIn = data.usage?.input_tokens || 0;
  const tokensOut = data.usage?.output_tokens || 0;

  const costCents =
    (tokensIn / 1_000_000) * pricing.inputCostPerMTok +
    (tokensOut / 1_000_000) * pricing.outputCostPerMTok;

  await logAiUsage({
    userId,
    model,
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

  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    console.error('No valid JSON found in AI response:', text.slice(0, 300));
    // For draft letters, try to return the raw text as the body
    return { subject: '', body: text.trim(), error: 'No JSON wrapper', _parse_error: true };
  }

  const jsonStr = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.error('Failed to parse AI JSON:', jsonStr.slice(0, 300));
    try {
      const fixed = jsonStr
        .replace(/'/g, '"')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      return JSON.parse(fixed);
    } catch {
      return { subject: '', body: text.trim(), error: 'Invalid JSON', _parse_error: true };
    }
  }
}
