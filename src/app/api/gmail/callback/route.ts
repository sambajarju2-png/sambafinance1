import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { encrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/gmail/callback — Google OAuth callback
export async function GET(req: NextRequest) {
  const DEADLINE = Date.now() + 8000
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // Supabase access token
    const error = url.searchParams.get('error')

    if (error) {
      return NextResponse.redirect(new URL(`/?error=gmail_${error}`, req.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/?error=gmail_missing_params', req.url))
    }

    guard()

    // Verify the Supabase user from the state token
    const supabase = getSupabaseAdmin()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(state)
    if (authErr || !user) {
      return NextResponse.redirect(new URL('/?error=gmail_auth_failed', req.url))
    }

    guard()

    // Exchange the code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${url.origin}/api/gmail/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error('Google token exchange failed:', errBody)
      return NextResponse.redirect(new URL('/?error=gmail_token_failed', req.url))
    }

    guard()

    const tokens = await tokenRes.json()

    // Get the Gmail email address
    const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    let email = user.email || 'unknown'
    if (profileRes.ok) {
      const profile = await profileRes.json()
      email = profile.emailAddress || email
    }

    guard()

    // Encrypt tokens before storing
    const encryptedAccess = await encrypt(tokens.access_token)
    const encryptedRefresh = await encrypt(tokens.refresh_token || '')

    // Store in gmail_accounts table
    const { error: dbError } = await supabase
      .from('gmail_accounts')
      .upsert({
        user_id: user.id,
        email,
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: Date.now() + (tokens.expires_in * 1000),
      }, { onConflict: 'user_id,email' })

    if (dbError) {
      console.error('Failed to store Gmail tokens:', dbError)
      return NextResponse.redirect(new URL('/?error=gmail_store_failed', req.url))
    }

    // Redirect back to the app with success
    return NextResponse.redirect(new URL('/?gmail=connected', req.url))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') {
      return NextResponse.redirect(new URL('/?error=timeout', req.url))
    }
    console.error('Gmail callback error:', message)
    return NextResponse.redirect(new URL('/?error=gmail_callback_error', req.url))
  }
}
