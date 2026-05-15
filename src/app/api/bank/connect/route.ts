import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { startAuth } from '@/lib/enablebanking'
import { randomUUID } from 'crypto'
import { verifyCsrf } from '@/lib/csrf'
import { log } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    await verifyCsrf()
    const { institution_id, institution_name, institution_logo } = await req.json()

    if (!institution_id || !institution_name) {
      return NextResponse.json({ error: 'institution_id en institution_name zijn verplicht' }, { status: 400 })
    }

    // Get authenticated user
    const cookieHeader = req.headers.get('cookie')
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            if (!cookieHeader) return []
            return cookieHeader.split(';').map(c => {
              const [name, ...rest] = c.trim().split('=')
              return { name, value: rest.join('=') }
            })
          },
          setAll() {}
        }
      }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check for existing PENDING connection (user may have started auth but not completed)
    // Allow multiple LINKED accounts from the same bank (personal + business, etc.)
    const { data: existingPending } = await supabase
      .from('bank_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('institution_name', institution_name)
      .eq('status', 'pending')
      .single()

    if (existingPending) {
      // Delete the stale pending connection so user can retry
      await supabase.from('bank_connections').delete().eq('id', existingPending.id)
    }

    // Start Enable Banking auth flow
    const state = randomUUID()
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'}/api/bank/callback`

    const authResult = await startAuth(institution_name, 'NL', redirectUrl, state)

    // PW-02: Store state bound to THIS user (expires in 10 minutes)
    await supabase.from('pending_bank_auths').insert({
      state,
      user_id: user.id,
      institution_name,
    })

    // Save connection with pending status
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 90)

    await supabase.from('bank_connections').insert({
      user_id: user.id,
      institution_id: institution_name,
      institution_name,
      institution_logo: institution_logo || null,
      requisition_id: authResult.authorization_id,  // reusing column for EB authorization_id
      agreement_id: state,                           // reusing column for state matching
      status: 'pending',
      access_valid_until: validUntil.toISOString()
    })

    // Log explicit consent for bank data access (GDPR compliance)
    await supabase.from('consent_log').insert({
      user_id: user.id,
      consent_type: 'bank_connection',
      granted: true,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || null,
      user_agent: req.headers.get('user-agent') || null,
    })

    return NextResponse.json({
      link: authResult.url,
      authorization_id: authResult.authorization_id
    })
  } catch (error) {
    console.error('[Bank] Connect error:', error)
    return NextResponse.json({ error: 'Kon bankverbinding niet starten' }, { status: 500 })
  }
}
