import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { encrypt } from '@/lib/crypto'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const DEADLINE = Date.now() + 8000
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const baseUrl = url.origin

    if (error) return NextResponse.redirect(new URL(`/?error=gmail_${error}`, baseUrl))
    if (!code || !state) return NextResponse.redirect(new URL(`/?error=gmail_missing_params`, baseUrl))

    guard()
    const supabase = getSupabaseAdmin()

    // Validate the user from the JWT token passed as state
    const { data: { user }, error: authErr } = await supabase.auth.getUser(state)
    if (authErr || !user) {
      console.error('Gmail callback: auth failed', authErr?.message || 'no user')
      return NextResponse.redirect(new URL(`/?error=gmail_auth_failed&detail=${encodeURIComponent(authErr?.message || 'no_user')}`, baseUrl))
    }

    guard()

    // Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${baseUrl}/api/gmail/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('Gmail callback: token exchange failed', tokenRes.status, errText)
      return NextResponse.redirect(new URL(`/?error=gmail_token_failed&status=${tokenRes.status}`, baseUrl))
    }

    guard()
    const tokens = await tokenRes.json()

    if (!tokens.access_token) {
      console.error('Gmail callback: no access_token in response', JSON.stringify(tokens))
      return NextResponse.redirect(new URL(`/?error=gmail_no_token`, baseUrl))
    }

    // Get Gmail profile
    const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    let email = user.email || 'unknown'
    if (profileRes.ok) {
      const profile = await profileRes.json()
      email = profile.emailAddress || email
    }

    guard()

    // Encrypt and store
    const encryptedAccess = await encrypt(tokens.access_token)
    const encryptedRefresh = await encrypt(tokens.refresh_token || '')

    const { error: dbError } = await supabase.from('gmail_accounts').upsert({
      user_id: user.id,
      email,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: Date.now() + ((tokens.expires_in || 3600) * 1000),
    }, { onConflict: 'user_id,email' })

    if (dbError) {
      console.error('Gmail callback: DB store failed', dbError.message)
      return NextResponse.redirect(new URL(`/?error=gmail_store_failed&detail=${encodeURIComponent(dbError.message)}`, baseUrl))
    }

    return NextResponse.redirect(new URL(`/?gmail=connected`, baseUrl))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Gmail callback error:', message)
    return NextResponse.redirect(new URL(`/?error=gmail_callback_error&detail=${encodeURIComponent(message)}`, new URL(req.url).origin))
  }
}
