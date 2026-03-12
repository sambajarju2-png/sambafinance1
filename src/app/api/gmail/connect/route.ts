import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return NextResponse.redirect(new URL('/?error=google_not_configured', req.url))
  const url = new URL(req.url)
  const redirectUri = `${url.origin}/api/gmail/callback`
  const accessToken = url.searchParams.get('token') || ''

  // Resolve user ID from the JWT so we can pass a short state string
  let userId = ''
  if (accessToken) {
    try {
      const supabase = getSupabaseAdmin()
      const { data: { user } } = await supabase.auth.getUser(accessToken)
      if (user) userId = user.id
    } catch {}
  }

  if (!userId) {
    return NextResponse.redirect(new URL('/?error=gmail_no_user', url.origin))
  }

  // Pass userId as state (36 chars UUID — safe for Google's state param)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  })
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
