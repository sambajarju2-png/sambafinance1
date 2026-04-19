import { logAiUsage } from './usage-log';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Stream a chat response from Claude Haiku.
 * Returns a ReadableStream of SSE events.
 *
 * SERVER-ONLY — never import in client components.
 */
export async function streamChat(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  userId: string
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const startTime = Date.now();
  const encoder = new TextEncoder();

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Haiku streaming error:', response.status, errText);
    throw new Error(`Haiku API error: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let buffer = '';

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);

              if (event.type === 'content_block_delta' && event.delta?.text) {
                // Strip em-dashes and en-dashes from output
                const cleanedText = event.delta.text
                  .replace(/—/g, ' - ')
                  .replace(/–/g, '-');
                fullText += cleanedText;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'text', text: cleanedText })}\n\n`)
                );
              }

              if (event.type === 'message_delta' && event.usage) {
                outputTokens = event.usage.output_tokens || 0;
              }

              if (event.type === 'message_start' && event.message?.usage) {
                inputTokens = event.message.usage.input_tokens || 0;
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }

        // Send done event with full text
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', fullText })}\n\n`)
        );
        controller.close();

        // Log usage async (don't block the stream)
        const durationMs = Date.now() - startTime;
        const costCents =
          (inputTokens / 1_000_000) * 80 +
          (outputTokens / 1_000_000) * 400;

        logAiUsage({
          userId,
          model: HAIKU_MODEL,
          operation: 'chat_stream',
          tokensIn: inputTokens,
          tokensOut: outputTokens,
          costCents,
          durationMs,
        }).catch(() => {});
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`)
        );
        controller.close();
      }
    },
  });
}
