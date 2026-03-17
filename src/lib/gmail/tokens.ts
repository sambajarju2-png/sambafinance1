import { encrypt, decrypt } from '@/lib/encryption';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Get valid Gmail tokens for an account.
 * Decrypts stored tokens, refreshes if expired, re-encrypts and updates DB.
 * Returns null if the account needs re-auth.
 *
 * SERVER-ONLY.
 */
export async function getValidTokens(accountId: string, userId: string): Promise<GmailTokens | null> {
  const supabase = await createServerSupabaseClient();

  const { data: account, error } = await supabase
    .from('gmail_accounts')
    .select('access_token, refresh_token, token_expires_at, needs_reauth')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();

  if (error || !account || account.needs_reauth) {
    return null;
  }

  try {
    const accessToken = decrypt(account.access_token);
    const refreshToken = decrypt(account.refresh_token);
    const expiresAt = account.token_expires_at;

    // Check if token is expired (with 60s buffer)
    const now = Math.floor(Date.now() / 1000);
    if (now < expiresAt - 60) {
      // Token still valid
      return { accessToken, refreshToken, expiresAt };
    }

    // Token expired — refresh it
    const refreshed = await refreshAccessToken(refreshToken);
    if (!refreshed) {
      // Refresh failed — mark for re-auth
      await supabase
        .from('gmail_accounts')
        .update({ needs_reauth: true })
        .eq('id', accountId)
        .eq('user_id', userId);
      return null;
    }

    // Encrypt and store new tokens
    const encryptedAccess = encrypt(refreshed.accessToken);
    const newExpiresAt = Math.floor(Date.now() / 1000) + refreshed.expiresIn;

    await supabase
      .from('gmail_accounts')
      .update({
        access_token: encryptedAccess,
        token_expires_at: newExpiresAt,
        needs_reauth: false,
      })
      .eq('id', accountId)
      .eq('user_id', userId);

    return {
      accessToken: refreshed.accessToken,
      refreshToken,
      expiresAt: newExpiresAt,
    };
  } catch (err) {
    console.error('Token decryption/refresh error:', err);
    await supabase
      .from('gmail_accounts')
      .update({ needs_reauth: true })
      .eq('id', accountId)
      .eq('user_id', userId);
    return null;
  }
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  } catch (err) {
    console.error('Token refresh request error:', err);
    return null;
  }
}
