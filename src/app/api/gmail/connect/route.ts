import { NextRequest, NextResponse } from 'next/server'

// GET /api/gmail/connect — starts the Google OAuth flow
// Called as a browser redirect from the frontend
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL('/?error=google_not_configured', req.url))
  }

  const url = new URL(req.url)
  const redirectUri = `${url.origin}/api/gmail/callback`

  // Get the Supabase token from query param (set by frontend before redirect)
  const accessToken = url.searchParams.get('token') || ''

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state: accessToken, // Will verify in callback
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
