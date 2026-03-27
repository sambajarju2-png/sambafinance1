/**
 * Outlook Token Management
 * 
 * Ensures a valid access token before making Graph API calls.
 * Handles automatic refresh when tokens expire.
 * 
 * File: src/lib/outlook-tokens.ts
 */

import { createServiceRoleClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/encryption'
import { refreshAccessToken } from '@/lib/microsoft-graph'

interface OutlookAccount {
  id: string
  user_id: string
  email: string
  access_token: string
  refresh_token: string
  token_expires_at: number
  needs_reauth: boolean
}

interface ValidToken {
  accessToken: string
  accountId: string
  email: string
}

export async function getValidOutlookToken(
  accountId: string,
  userId: string
): Promise<ValidToken | null> {
  const supabase = createServiceRoleClient()

  const { data: account, error } = await supabase
    .from('outlook_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()

  if (error || !account) {
    console.error('[Outlook Tokens] Account not found:', error)
    return null
  }

  if (account.needs_reauth) {
    console.warn(`[Outlook Tokens] Account ${account.email} needs reauth`)
    return null
  }

  const acct = account as OutlookAccount

  // Check if token is still valid (with 5 minute buffer)
  const isExpired = acct.token_expires_at < Date.now() + 5 * 60 * 1000

  if (!isExpired) {
    return {
      accessToken: decrypt(acct.access_token),
      accountId: acct.id,
      email: acct.email,
    }
  }

  // Token expired — refresh it
  console.log(`[Outlook Tokens] Refreshing expired token for ${acct.email}`)

  try {
    const decryptedRefreshToken = decrypt(acct.refresh_token)
    const newTokens = await refreshAccessToken(decryptedRefreshToken)

    const encryptedAccessToken = encrypt(newTokens.access_token)
    const encryptedRefreshToken = newTokens.refresh_token
      ? encrypt(newTokens.refresh_token)
      : acct.refresh_token

    const newExpiresAt = Date.now() + newTokens.expires_in * 1000

    const { error: updateError } = await supabase
      .from('outlook_accounts')
      .update({
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: newExpiresAt,
        needs_reauth: false,
      })
      .eq('id', acct.id)

    if (updateError) {
      console.error('[Outlook Tokens] Failed to update refreshed tokens:', updateError)
      return null
    }

    return {
      accessToken: newTokens.access_token,
      accountId: acct.id,
      email: acct.email,
    }
  } catch (refreshError) {
    console.error(`[Outlook Tokens] Refresh failed for ${acct.email}:`, refreshError)

    await supabase
      .from('outlook_accounts')
      .update({ needs_reauth: true })
      .eq('id', acct.id)

    return null
  }
}

export async function getUserOutlookAccounts(userId: string) {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('outlook_accounts')
    .select('id, email, last_scanned, scan_progress, full_scan_complete, needs_reauth, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[Outlook Tokens] Failed to fetch accounts:', error)
    return []
  }

  return data || []
}
