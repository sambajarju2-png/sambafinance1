import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * POST /api/gmail/connect
 * Uses SERVICE ROLE client because gmail_oauth_states has RLS with no policies.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID in Vercel.' },
        { status: 500, headers: NO_CACHE }
      );
    }

    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Use service role — gmail_oauth_states has RLS with no anon policies
    const supabase = createServiceRoleClient();

    // Clean up expired states
    await supabase
      .from('gmail_oauth_states')
      .delete()
      .lt('expires_at', new Date().toISOString());

    // Store the state
    const { error: stateError } = await supabase
      .from('gmail_oauth_states')
      .insert({ state, user_id: userId, expires_at: expiresAt });

    if (stateError) {
      console.error('Failed to store OAuth state:', stateError);
      return NextResponse.json(
        { error: 'Failed to initiate OAuth flow' },
        { status: 500, headers: NO_CACHE }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hypesamba.com';
    const redirectUri = `${appUrl}/api/gmail/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({ url: authUrl }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Gmail connect error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: NO_CACHE });
  }
}
