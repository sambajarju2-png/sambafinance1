import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { verifyCsrf } from '@/lib/csrf';

// Least-privilege: the app can create + manage ONLY its own calendar/events.
// It cannot see or touch the user's other calendars. (Calendar writes are a
// sensitive/restricted scope — production launch needs Google verification.)
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

/**
 * POST /api/calendar/connect
 * Service-role client (calendar_oauth_states is RLS with no policies).
 */
export async function POST(req: NextRequest) {
  try { await verifyCsrf(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID in Vercel.' },
      { status: 500, headers: NO_CACHE },
    );
  }

  const state = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const supabase = createServiceRoleClient();

  await supabase.from('calendar_oauth_states').delete().lt('expires_at', new Date().toISOString());

  let isNative = false;
  try { const body = await req.json(); isNative = body.native === true; } catch { /* no body */ }

  const { error: stateError } = await supabase
    .from('calendar_oauth_states')
    .insert({ state, user_id: userId, expires_at: expiresAt, is_native: isNative });
  if (stateError) {
    console.error('[calendar/connect] failed to store state:', stateError);
    return NextResponse.json({ error: 'Failed to initiate OAuth flow' }, { status: 500, headers: NO_CACHE });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app';
  const redirectUri = `${appUrl}/api/calendar/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: `${CALENDAR_SCOPE} email profile`,
    state,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.json({ url: authUrl }, { headers: NO_CACHE });
}
