/**
 * POST /api/auth/outlook/connect
 * 
 * Initiates the Microsoft OAuth2 flow for Outlook/Hotmail email access.
 * 
 * File: src/app/api/auth/outlook/connect/route.ts
 */

import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAuthUserId } from '@/lib/auth'
import { getMicrosoftAuthUrl } from '@/lib/microsoft-graph'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET || !process.env.MICROSOFT_REDIRECT_URI) {
      console.error('[Outlook Connect] Missing Microsoft OAuth environment variables')
      return NextResponse.json(
        { error: 'Outlook integratie is nog niet geconfigureerd' },
        { status: 500 }
      )
    }

    // Generate cryptographic state parameter (CSRF protection)
    const state = randomBytes(32).toString('hex')

    const supabase = createServiceRoleClient()
    
    // Clean up expired states
    await supabase.rpc('cleanup_expired_outlook_oauth_states').catch(() => {})

    const { error: stateError } = await supabase
      .from('outlook_oauth_states')
      .insert({
        state,
        user_id: userId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })

    if (stateError) {
      console.error('[Outlook Connect] Failed to store OAuth state:', stateError)
      return NextResponse.json(
        { error: 'Kon OAuth sessie niet starten' },
        { status: 500 }
      )
    }

    const authUrl = getMicrosoftAuthUrl(state)

    return NextResponse.json({ url: authUrl })
  } catch (error) {
    console.error('[Outlook Connect] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het verbinden met Outlook' },
      { status: 500 }
    )
  }
}
