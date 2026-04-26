import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { startAuth } from '@/lib/enablebanking'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
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
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'}/api/bank/callback`
    const state = randomUUID()

    const authResult = await startAuth(institution_name, 'NL', redirectUrl, state)

    // Save connection
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

    return NextResponse.json({
      link: authResult.url,
      authorization_id: authResult.authorization_id
    })
  } catch (error) {
    console.error('[Bank] Connect error:', error)
    return NextResponse.json({ error: 'Kon bankverbinding niet starten' }, { status: 500 })
  }
}
