import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/gmail/connect
 * Generates a CSRF state parameter, stores it in gmail_oauth_states,
 * and returns the Google OAuth URL for the user to authorize.
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
        { error: 'Google OAuth is not configured' },
        { status: 500, headers: NO_CACHE }
      );
    }

    // Generate cryptographic state for CSRF protection
    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const supabase = await createServerSupabaseClient();

    // Clean up expired states first
    await supabase
      .from('gmail_oauth_states')
      .delete()
      .lt('expires_at', new Date().toISOString());

    // Store the state
    const { error: stateError } = await supabase
      .from('gmail_oauth_states')
      .insert({
        state,
        user_id: userId,
        expires_at: expiresAt.toISOString(),
      });

    if (stateError) {
      console.error('Failed to store OAuth state:', stateError);
      return NextResponse.json(
        { error: 'Failed to initiate OAuth flow' },
        { status: 500, headers: NO_CACHE }
      );
    }

    // Build Google OAuth URL
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
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: NO_CACHE }
    );
  }
}
