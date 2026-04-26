/**
 * GET /api/auth/outlook/callback
 * 
 * Debug version: logs EVERY step to outlook_debug_log table.
 * Check results: SELECT * FROM outlook_debug_log ORDER BY id DESC;
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
import { oauthRedirect } from '@/lib/oauth-redirect';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Create supabase client FIRST so we can log everything
  const supabase = createServiceRoleClient();
  
  async function log(step: string, message: string) {
    try {
      await supabase.from('outlook_debug_log').insert({ step, message: message.slice(0, 2000) });
    } catch {
      console.error(`[Outlook Debug] Could not log: ${step} — ${message}`);
    }
    console.log(`[Outlook Callback] ${step}: ${message}`);
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app';
  const settingsUrl = `${baseUrl}/instellingen`;

  await log('0_callback_hit', `code=${!!code}, state=${!!state}, error=${error || 'none'}, fullUrl=${request.nextUrl.pathname}${request.nextUrl.search}`);

  // Handle Microsoft errors
  if (error) {
    await log('microsoft_error', `${error}: ${errorDescription || 'no description'}`);
    if (error === 'access_denied') {
      return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=cancelled`);
    }
    return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`);
  }

  if (!code || !state) {
    await log('missing_params', `code=${code}, state=${state}`);
    return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`);
  }

  // Step 1: Validate state
  try {
    await log('1_validate_state_start', `state=${state.slice(0, 16)}...`);
    
    const { data: stateRecord, error: stateError } = await supabase
      .from('outlook_oauth_states')
      .select('user_id, expires_at, is_native')
      .eq('state', state)
      .single();

    if (stateError || !stateRecord) {
      await log('1_validate_state_fail', `error=${stateError?.message || 'not found'}, code=${stateError?.code}`);
      return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`);
    }

    if (new Date(stateRecord.expires_at) < new Date()) {
      await log('1_state_expired', `expired_at=${stateRecord.expires_at}`);
      await supabase.from('outlook_oauth_states').delete().eq('state', state);
      return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`);
    }

    const userId = stateRecord.user_id;
    const isNative = stateRecord.is_native === true;
    await log('1_validate_state_ok', `user_id=${userId}`);

    // Delete used state
    await supabase.from('outlook_oauth_states').delete().eq('state', state);
    await log('1_state_deleted', 'ok');

    // Step 2: Exchange code for tokens
    await log('2_token_exchange_start', 'calling exchangeCodeForTokens...');
    
    let tokens;
    try {
      tokens = await exchangeCodeForTokens(code);
      await log('2_token_exchange_ok', `has_access_token=${!!tokens.access_token}, has_refresh_token=${!!tokens.refresh_token}, expires_in=${tokens.expires_in}`);
    } catch (e: unknown) {
      await log('2_token_exchange_FAIL', e instanceof Error ? e.message : String(e));
      return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`, isNative);
    }

    // Step 3: Get email
    await log('3_get_email_start', 'calling getUserEmail...');
    
    let outlookEmail: string;
    try {
      outlookEmail = await getUserEmail(tokens.access_token);
      await log('3_get_email_ok', `email=${outlookEmail}`);
    } catch (e: unknown) {
      await log('3_get_email_FAIL', e instanceof Error ? e.message : String(e));
      return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`, isNative);
    }

    if (!outlookEmail) {
      await log('3_get_email_empty', 'getUserEmail returned empty');
      return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`, isNative);
    }

    // Step 4: Encrypt tokens
    await log('4_encrypt_start', 'encrypting tokens...');
    
    let encryptedAccessToken: string;
    let encryptedRefreshToken: string;
    try {
      encryptedAccessToken = encrypt(tokens.access_token);
      encryptedRefreshToken = encrypt(tokens.refresh_token);
      await log('4_encrypt_ok', `access_len=${encryptedAccessToken.length}, refresh_len=${encryptedRefreshToken.length}`);
    } catch (e: unknown) {
      await log('4_encrypt_FAIL', e instanceof Error ? e.message : String(e));
      return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`, isNative);
    }

    const tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

    // Step 5: Upsert
    await log('5_upsert_start', `email=${outlookEmail}, user_id=${userId}`);
    
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
          { onConflict: 'user_id,email' }
        );

      if (upsertError) {
        await log('5_upsert_FAIL', `${upsertError.message} (code: ${upsertError.code}, details: ${upsertError.details})`);
        return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`, isNative);
      }
      
      await log('5_upsert_ok', 'account saved');
    } catch (e: unknown) {
      await log('5_upsert_CATCH', e instanceof Error ? e.message : String(e));
      return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`, isNative);
    }

    await log('6_SUCCESS', `${outlookEmail} connected for user ${userId}`);
    return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=connected`, isNative);

  } catch (e: unknown) {
    // Top-level catch — if ANYTHING uncaught happens
    await log('TOP_LEVEL_CATCH', e instanceof Error ? `${e.message}\n${e.stack}` : String(e));
    return oauthRedirect(request, `${settingsUrl}?tab=sync&outlook=error`, isNative);
  }
}
