/**
 * GET /api/auth/outlook/callback
 * 
 * Handles the Microsoft OAuth2 callback after user authorizes.
 * Flow: validate state → exchange code → encrypt tokens → store → redirect.
 * 
 * File: src/app/api/auth/outlook/callback/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import {
  exchangeCodeForTokens,
  getUserEmail,
} from '@/lib/microsoft-graph'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'
  const settingsUrl = `${baseUrl}/instellingen`

  // Handle Microsoft OAuth errors
  if (error) {
    console.error(`[Outlook Callback] Microsoft OAuth error: ${error} — ${errorDescription}`)
    
    if (error === 'access_denied') {
      return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=cancelled`)
    }
    
    return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=error&reason=${error}`)
  }

  if (!code || !state) {
    console.error('[Outlook Callback] Missing code or state parameter')
    return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=error&reason=missing_params`)
  }

  const supabase = createServiceRoleClient()

  try {
    // Step 1: Validate state against DB (CSRF protection)
    const { data: stateRecord, error: stateError } = await supabase
      .from('outlook_oauth_states')
      .select('user_id, expires_at')
      .eq('state', state)
      .single()

    if (stateError || !stateRecord) {
      console.error('[Outlook Callback] Invalid or expired state:', stateError)
      return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=error&reason=invalid_state`)
    }

    if (new Date(stateRecord.expires_at) < new Date()) {
      console.error('[Outlook Callback] State expired')
      await supabase.from('outlook_oauth_states').delete().eq('state', state)
      return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=error&reason=state_expired`)
    }

    const userId = stateRecord.user_id

    // Delete used state immediately (one-time use)
    await supabase.from('outlook_oauth_states').delete().eq('state', state)

    // Step 2: Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Step 3: Get user's Outlook email address
    const outlookEmail = await getUserEmail(tokens.access_token)

    if (!outlookEmail) {
      console.error('[Outlook Callback] Could not retrieve email from Microsoft Graph')
      return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=error&reason=no_email`)
    }

    // Step 4: Encrypt tokens (AES-256-GCM, unique IV per token)
    const encryptedAccessToken = encrypt(tokens.access_token)
    const encryptedRefreshToken = encrypt(tokens.refresh_token)
    const tokenExpiresAt = Date.now() + tokens.expires_in * 1000

    // Step 5: Upsert in outlook_accounts table
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
      )

    if (upsertError) {
      console.error('[Outlook Callback] Failed to store tokens:', upsertError)
      return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=error&reason=db_error`)
    }

    console.log(`[Outlook Callback] Successfully connected ${outlookEmail} for user ${userId}`)

    return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=connected`)

  } catch (err) {
    console.error('[Outlook Callback] Unexpected error:', err)
    return NextResponse.redirect(`${settingsUrl}?tab=sync&outlook=error&reason=unknown`)
  }
}
