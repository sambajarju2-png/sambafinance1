import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Check and enforce rate limits.
 * Uses the rate_limits table (service role — no RLS).
 *
 * Returns true if the request is allowed, false if rate limited.
 *
 * SERVER-ONLY.
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowMinutes: number
): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient();
    const windowStart = new Date(
      Date.now() - windowMinutes * 60 * 1000
    ).toISOString();

    // Count requests in the current window
    const { count, error } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart);

    if (error) {
      console.error('Rate limit check error:', error);
      return true; // Allow on error (fail-open)
    }

    if ((count || 0) >= maxRequests) {
      return false; // Rate limited
    }

    // Record this request
    await supabase.from('rate_limits').insert({
      user_id: userId,
      endpoint,
      window_start: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.error('Rate limit error:', err);
    return true; // Fail-open
  }
}
