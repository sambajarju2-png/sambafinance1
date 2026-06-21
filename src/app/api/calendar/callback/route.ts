import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/encryption';
import { oauthRedirect } from '@/lib/oauth-redirect';
import { createAppCalendar, deleteCalendar } from '@/lib/calendar/google';
import { reconcileConnection, CALENDAR_SUMMARY } from '@/lib/calendar/sync';

/**
 * GET /api/calendar/callback
 * Service-role client for all DB operations. Provisions the dedicated calendar
 * and backfills current bills before redirecting back to settings.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app';
  const back = (status: string, isNative = false, reason?: string) =>
    oauthRedirect(
      req,
      `${appUrl}/instellingen?tab=calendar&status=${status}${reason ? `&reason=${reason}` : ''}`,
      isNative,
    );

  if (error) return back('denied');
  if (!code || !state) return back('error', false, 'missing_params');

  try {
    const supabase = createServiceRoleClient();

    const { data: stateRow, error: stateError } = await supabase
      .from('calendar_oauth_states')
      .select('user_id, expires_at, is_native')
      .eq('state', state)
      .single();
    if (stateError || !stateRow) return back('error', false, 'invalid_state');

    const isNative = stateRow.is_native === true;
    if (new Date(stateRow.expires_at) < new Date()) {
      await supabase.from('calendar_oauth_states').delete().eq('state', state);
      return back('error', isNative, 'expired');
    }
    const userId = stateRow.user_id;
    await supabase.from('calendar_oauth_states').delete().eq('state', state);

    // Exchange code for tokens.
    const redirectUri = `${appUrl}/api/calendar/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) {
      console.error('[calendar/callback] token exchange failed:', tokenResponse.status, await tokenResponse.text());
      return back('error', isNative, 'token_exchange');
    }
    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;
    if (!access_token || !refresh_token) return back('error', isNative, 'missing_tokens');

    // Connected account email (best-effort, for display only).
    let accountEmail: string | null = null;
    try {
      const p = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (p.ok) accountEmail = (await p.json()).email ?? null;
    } catch { /* non-fatal */ }

    // If reconnecting, remember the old calendar so we can clean it up.
    const { data: existing } = await supabase
      .from('calendar_connections')
      .select('id, calendar_id')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();
    const oldCalendarId = existing?.calendar_id || null;

    // Provision the dedicated calendar now so any failure surfaces immediately.
    let calendarId: string;
    try {
      calendarId = await createAppCalendar(access_token, CALENDAR_SUMMARY);
    } catch (e) {
      console.error('[calendar/callback] calendar provisioning failed:', e);
      return back('error', isNative, 'calendar_create');
    }

    // Best-effort remove the previous calendar + stale mappings on reconnect.
    if (oldCalendarId && oldCalendarId !== calendarId) {
      try { await deleteCalendar(access_token, oldCalendarId); } catch { /* non-fatal */ }
    }

    const tokenExpiresAt = Math.floor(Date.now() / 1000) + (expires_in || 3600);
    const { data: conn, error: upsertError } = await supabase
      .from('calendar_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'google',
          account_email: accountEmail,
          access_token: encrypt(access_token),
          refresh_token: encrypt(refresh_token),
          token_expires_at: tokenExpiresAt,
          calendar_id: calendarId,
          needs_reauth: false,
          sync_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      )
      .select('id, user_id, calendar_id')
      .single();
    if (upsertError || !conn) {
      console.error('[calendar/callback] store failed:', upsertError);
      return back('error', isNative, 'store_failed');
    }

    // New calendar means any prior mapping is stale — start clean.
    await supabase.from('calendar_synced_events').delete().eq('connection_id', conn.id);

    // GDPR consent record.
    await supabase
      .from('consent_log')
      .insert({
        user_id: userId,
        consent_type: 'calendar_connection',
        granted: true,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || null,
        user_agent: req.headers.get('user-agent') || null,
      })
      .catch(() => {});

    // Backfill current bills (best-effort; the cron is the safety net).
    try {
      await reconcileConnection(supabase, conn as { id: string; user_id: string; calendar_id: string | null }, appUrl);
    } catch (e) {
      console.error('[calendar/callback] initial sync failed:', e);
    }

    return back('connected', isNative);
  } catch (err) {
    console.error('[calendar/callback] error:', err);
    return back('error', false, 'unknown');
  }
}
