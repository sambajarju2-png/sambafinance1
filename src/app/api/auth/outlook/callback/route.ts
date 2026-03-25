/**
 * GET /api/auth/outlook/callback
 * 
 * Handles Microsoft OAuth2 callback after user authorizes.
 * Debug version: includes detailed error info in redirect URL.
 * 
 * File: src/app/api/auth/outlook/callback/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/encryption';
import {
  exchangeCodeForTokens,
  getUserEmail,
} from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app';
  const settingsUrl = `${baseUrl}/instellingen`;

  // Helper: redirect with detailed error info
  function errorRedirect(step: string, msg: string, extra?: string) {
    console.error(`[Outlook Callback] FAIL at ${step}: ${msg}`, extra || '');
    const params = new URLSearchParams({
      tab: 'sync',
      outlook: 'error',
      step,
      msg: msg.slice(0, 200),
    });
    return NextResponse.redirect(`${settingsUrl}?${params.toString()}`);
  }

  // Handle Microsoft OAuth errors
  if (error) {
    console.error(`[Outlook Callback] Microsoft error: ${error} — ${errorDescription}`);
    if (error === 'access_denied') {
      return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=cancelled`);
    }
    return errorRedirect('microsoft_error', `${error}: ${errorDescription || 'unknown'}`);
  }

  if (!code || !state) {
    return errorRedirect('missing_params', `code=${!!code}, state=${!!state}`);
  }

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch (e: unknown) {
    return errorRedirect('service_client', e instanceof Error ? e.message : String(e));
  }

  // Step 1: Validate state
  let userId: string;
  try {
    const { data: stateRecord, error: stateError } = await supabase
      .from('outlook_oauth_states')
      .select('user_id, expires_at')
      .eq('state', state)
      .single();

    if (stateError || !stateRecord) {
      return errorRedirect('validate_state', stateError?.message || 'State not found in DB');
    }

    if (new Date(stateRecord.expires_at) < new Date()) {
      await supabase.from('outlook_oauth_states').delete().eq('state', state);
      return errorRedirect('state_expired', `Expired at ${stateRecord.expires_at}`);
    }

    userId = stateRecord.user_id;

    // Delete used state immediately
    await supabase.from('outlook_oauth_states').delete().eq('state', state);
  } catch (e: unknown) {
    return errorRedirect('validate_state_catch', e instanceof Error ? e.message : String(e));
  }

  // Step 2: Exchange code for tokens
  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (e: unknown) {
    return errorRedirect('token_exchange', e instanceof Error ? e.message : String(e));
  }

  // Step 3: Get email
  let outlookEmail: string;
  try {
    outlookEmail = await getUserEmail(tokens.access_token);
    if (!outlookEmail) {
      return errorRedirect('get_email', 'getUserEmail returned empty');
    }
  } catch (e: unknown) {
    return errorRedirect('get_email_catch', e instanceof Error ? e.message : String(e));
  }

  // Step 4: Encrypt tokens
  let encryptedAccessToken: string;
  let encryptedRefreshToken: string;
  try {
    encryptedAccessToken = encrypt(tokens.access_token);
    encryptedRefreshToken = encrypt(tokens.refresh_token);
  } catch (e: unknown) {
    return errorRedirect('encrypt_tokens', e instanceof Error ? e.message : String(e));
  }

  const tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

  // Step 5: Upsert
  try {
    const { error: upsertError } = await supabase
      .from('outlook_accounts')
      .upsert(
        {
          user_id: userId,
          email: outlookEmail,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          needs_reauth: false,
          scan_progress: 0,
          scan_cursor: null,
        },
        {
          onConflict: 'user_id,email',
        }
      );

    if (upsertError) {
      return errorRedirect('upsert', `${upsertError.message} (code: ${upsertError.code})`);
    }
  } catch (e: unknown) {
    return errorRedirect('upsert_catch', e instanceof Error ? e.message : String(e));
  }

  console.log(`[Outlook Callback] SUCCESS: ${outlookEmail} connected for user ${userId}`);

  return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=connected`);
}
