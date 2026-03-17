import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/encryption';

/**
 * GET /api/gmail/callback
 * Uses SERVICE ROLE client for all DB operations.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hypesamba.com';

  if (error) {
    return NextResponse.redirect(`${appUrl}/instellingen?tab=gmail&status=denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/instellingen?tab=gmail&status=error&reason=missing_params`);
  }

  try {
    const supabase = createServiceRoleClient();

    // Validate state
    const { data: stateRow, error: stateError } = await supabase
      .from('gmail_oauth_states')
      .select('user_id, expires_at')
      .eq('state', state)
      .single();

    if (stateError || !stateRow) {
      return NextResponse.redirect(`${appUrl}/instellingen?tab=gmail&status=error&reason=invalid_state`);
    }

    if (new Date(stateRow.expires_at) < new Date()) {
      await supabase.from('gmail_oauth_states').delete().eq('state', state);
      return NextResponse.redirect(`${appUrl}/instellingen?tab=gmail&status=error&reason=expired`);
    }

    const userId = stateRow.user_id;
    await supabase.from('gmail_oauth_states').delete().eq('state', state);

    // Exchange code for tokens
    const redirectUri = `${appUrl}/api/gmail/callback`;
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
      const errBody = await tokenResponse.text();
      console.error('Token exchange failed:', errBody);
      return NextResponse.redirect(`${appUrl}/instellingen?tab=gmail&status=error&reason=token_exchange`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!access_token || !refresh_token) {
      return NextResponse.redirect(`${appUrl}/instellingen?tab=gmail&status=error&reason=missing_tokens`);
    }

    // Get Gmail email
    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    let gmailEmail = 'unknown@gmail.com';
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      gmailEmail = profile.email || gmailEmail;
    }

    // Encrypt and store tokens
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = encrypt(refresh_token);
    const tokenExpiresAt = Math.floor(Date.now() / 1000) + (expires_in || 3600);

    const { error: upsertError } = await supabase
      .from('gmail_accounts')
      .upsert(
        {
          user_id: userId,
          email: gmailEmail,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          needs_reauth: false,
        },
        { onConflict: 'user_id,email' }
      );

    if (upsertError) {
      console.error('Failed to store Gmail tokens:', upsertError);
      return NextResponse.redirect(`${appUrl}/instellingen?tab=gmail&status=error&reason=store_failed`);
    }

    return NextResponse.redirect(`${appUrl}/instellingen?tab=gmail&status=connected`);
  } catch (err) {
    console.error('Gmail callback error:', err);
    return NextResponse.redirect(`${appUrl}/instellingen?tab=gmail&status=error&reason=unknown`);
  }
}
