import { encrypt, decrypt } from '@/lib/encryption';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns a valid Google access token for a calendar connection, refreshing and
 * persisting it when expired. Marks `needs_reauth` and returns null if the refresh
 * fails. `supabase` MUST be a service-role client — the calendar_* tables have RLS
 * with no policies. SERVER-ONLY.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<string | null> {
  const { data: conn, error } = await supabase
    .from('calendar_connections')
    .select('access_token, refresh_token, token_expires_at, needs_reauth')
    .eq('id', connectionId)
    .single();
  if (error || !conn || conn.needs_reauth) return null;

  try {
    const accessToken = decrypt(conn.access_token);
    const refreshToken = decrypt(conn.refresh_token);
    const now = Math.floor(Date.now() / 1000);
    if (now < conn.token_expires_at - 60) return accessToken;

    const refreshed = await refreshAccessToken(refreshToken);
    if (!refreshed) {
      await supabase.from('calendar_connections').update({ needs_reauth: true }).eq('id', connectionId);
      return null;
    }
    const newExpiresAt = Math.floor(Date.now() / 1000) + refreshed.expiresIn;
    await supabase
      .from('calendar_connections')
      .update({
        access_token: encrypt(refreshed.accessToken),
        token_expires_at: newExpiresAt,
        needs_reauth: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);
    return refreshed.accessToken;
  } catch (err) {
    console.error('[calendar/tokens] decrypt/refresh error:', err);
    await supabase.from('calendar_connections').update({ needs_reauth: true }).eq('id', connectionId);
    return null;
  }
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      console.error('[calendar/tokens] refresh failed:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return { accessToken: data.access_token, expiresIn: data.expires_in || 3600 };
  } catch (err) {
    console.error('[calendar/tokens] refresh request error:', err);
    return null;
  }
}
