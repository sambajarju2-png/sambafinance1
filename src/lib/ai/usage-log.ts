import { createServiceRoleClient } from '@/lib/supabase/server';

interface AiUsageEntry {
  userId: string;
  model: string;
  operation: string;
  tokensIn?: number;
  tokensOut?: number;
  costCents?: number;
  durationMs: number;
}

/**
 * Log an AI API call to the ai_usage_log table.
 * Uses the service role client (no RLS) since this is server-only.
 * Never throws — logging failures are silent to not break the main flow.
 *
 * SERVER-ONLY — never import in client components.
 */
export async function logAiUsage(entry: AiUsageEntry): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    await supabase.from('ai_usage_log').insert({
      user_id: entry.userId,
      model: entry.model,
      operation: entry.operation,
      tokens_in: entry.tokensIn || 0,
      tokens_out: entry.tokensOut || 0,
      cost_cents: entry.costCents || 0,
      duration_ms: entry.durationMs,
    });
  } catch (err) {
    // Silent fail — never break the main flow for logging
    console.error('AI usage logging failed:', err);
  }
}
