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
    const state = url.searchParams.get('state') // This is now the userId (UUID)
    const error = url.searchParams.get('error')
    const baseUrl = url.origin

    if (error) return NextResponse.redirect(new URL(`/?error=gmail_${error}`, baseUrl))
    if (!code || !state) return NextResponse.redirect(new URL(`/?error=gmail_missing_params`, baseUrl))

    // Validate that state looks like a UUID (user_id)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(state)) {
      console.error('Gmail callback: state is not a valid UUID:', state.substring(0, 20))
      return NextResponse.redirect(new URL(`/?error=gmail_invalid_state`, baseUrl))
    }

    const userId = state
    guard()

    const supabase = getSupabaseAdmin()

    // Verify user exists
    const { data: { user }, error: authErr } = await supabase.auth.admin.getUserById(userId)
    if (authErr || !user) {
      console.error('Gmail callback: user not found', userId, authErr?.message)
      return NextResponse.redirect(new URL(`/?error=gmail_user_not_found`, baseUrl))
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
      console.error('Gmail callback: no access_token in Google response')
      return NextResponse.redirect(new URL(`/?error=gmail_no_access_token`, baseUrl))
    }

    // Get Gmail email address
    const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    let email = user.email || 'unknown'
    if (profileRes.ok) {
      const profile = await profileRes.json()
      email = profile.emailAddress || email
    } else {
      console.error('Gmail callback: profile fetch failed', profileRes.status)
    }

    guard()

    // Encrypt tokens
    const encryptedAccess = await encrypt(tokens.access_token)
    const encryptedRefresh = await encrypt(tokens.refresh_token || '')

    // Store in DB
    const { error: dbError } = await supabase.from('gmail_accounts').upsert({
      user_id: userId,
      email,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: Date.now() + ((tokens.expires_in || 3600) * 1000),
    }, { onConflict: 'user_id,email' })

    if (dbError) {
      console.error('Gmail callback: DB upsert failed', dbError.message)
      return NextResponse.redirect(new URL(`/?error=gmail_db_error&detail=${encodeURIComponent(dbError.message)}`, baseUrl))
    }

    console.log('Gmail callback: SUCCESS for user', userId, 'email', email)
    return NextResponse.redirect(new URL(`/?gmail=connected`, baseUrl))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Gmail callback exception:', message)
    return NextResponse.redirect(new URL(`/?error=gmail_exception&detail=${encodeURIComponent(message)}`, new URL(req.url).origin))
  }
}
