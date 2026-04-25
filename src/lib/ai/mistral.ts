import { logAiUsage } from './usage-log';

const SCALEWAY_API_URL = 'https://api.scaleway.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-3.2-24b-instruct-2506';

/**
 * Call Mistral Small 3.2 (via Scaleway Generative API) with a text prompt.
 * Uses JSON output mode. EU-hosted (Paris). OpenAI-compatible.
 * SERVER-ONLY.
 */
export async function callMistralText(
  prompt: string,
  userId: string,
  operation: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.SCW_SECRET_KEY;
  if (!apiKey) throw new Error('SCW_SECRET_KEY is not set');

  const startTime = Date.now();

  const response = await fetch(SCALEWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.error('[Mistral] API error:', response.status, '-', errText);
    throw new Error(`Mistral API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const tokensIn = data.usage?.prompt_tokens || 0;
  const tokensOut = data.usage?.completion_tokens || 0;

  // Scaleway pricing: Input €0.15/M tokens, Output €0.35/M tokens
  const costCents = (tokensIn * 0.000015) + (tokensOut * 0.000035);

  await logAiUsage({
    userId, model: MISTRAL_MODEL, operation, tokensIn, tokensOut,
    costCents, durationMs,
  });

  return parseJsonResponseLenient(text);
}

/**
 * Call Mistral Small 3.2 Vision (via Scaleway) with an image.
 * Uses multimodal content array (OpenAI format).
 * SERVER-ONLY.
 */
export async function callMistralVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  userId: string,
  operation: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.SCW_SECRET_KEY;
  if (!apiKey) throw new Error('SCW_SECRET_KEY is not set');

  const startTime = Date.now();

  const response = await fetch(SCALEWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.error('[Mistral Vision] API error:', response.status, '-', errText);
    if (response.status === 400) {
      throw new Error('De foto kon niet worden verwerkt. Probeer een duidelijkere foto.');
    }
    throw new Error(`Mistral Vision API error: ${response.status}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice || choice.finish_reason === 'content_filter') {
    throw new Error('De foto werd geblokkeerd. Probeer een andere foto.');
  }

  const text = choice.message?.content || '';
  if (!text.trim()) {
    throw new Error('Mistral kon geen tekst uit de foto halen. Probeer een duidelijkere foto.');
  }

  const tokensIn = data.usage?.prompt_tokens || 0;
  const tokensOut = data.usage?.completion_tokens || 0;

  const costCents = (tokensIn * 0.000015) + (tokensOut * 0.000035);

  await logAiUsage({
    userId, model: `${MISTRAL_MODEL}-vision`, operation, tokensIn, tokensOut,
    costCents, durationMs,
  });

  return parseJsonResponseLenient(text);
}

/**
 * Lenient JSON parse — handles truncated responses, broken JSON, markdown fences.
 * With response_format: json_object, most issues should be gone,
 * but we keep this as a safety net.
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
  console.warn('[Mistral] JSON parse failed, extracting fields from text:', text.slice(0, 300));
  return extractFieldsFromText(text);
}

function repairTruncatedJson(partial: string): string | null {
  try {
    let fixed = partial;
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

    if (inString) fixed += '"';
    fixed = fixed.replace(/:\s*$/, ': null');
    fixed = fixed.replace(/,\s*$/, '');
    for (let i = 0; i < brackets; i++) fixed += ']';
    for (let i = 0; i < braces; i++) fixed += '}';

    return fixed;
  } catch {
    return null;
  }
}

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

function extractFieldsFromText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = { _parse_error: true };

  const isBillMatch = text.match(/"is_bill"\s*:\s*(true|false)/i);
  if (isBillMatch) result.is_bill = isBillMatch[1] === 'true';

  const confMatch = text.match(/"confidence"\s*:\s*([\d.]+)/);
  if (confMatch) result.confidence = parseFloat(confMatch[1]);

  const reasonMatch = text.match(/"reason"\s*:\s*"([^"]*)/);
  if (reasonMatch) result.reason = reasonMatch[1];

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
