import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAgreement, createRequisition } from '@/lib/gocardless'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { institution_id, institution_name, institution_logo } = await req.json()

    if (!institution_id || !institution_name) {
      return NextResponse.json({ error: 'institution_id en institution_name zijn verplicht' }, { status: 400 })
    }

    // Get user from Supabase auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('authorization')
    const cookieHeader = req.headers.get('cookie')

    // Extract user ID from auth
    const { createServerClient } = await import('@supabase/ssr')
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          setAll(_cookies) { /* no-op in route handler */ }
        }
      }
    )

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    // Check if user already has this bank connected
    const { data: existing } = await supabase
      .from('bank_connections')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('institution_id', institution_id)
      .in('status', ['pending', 'linked'])
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Deze bank is al gekoppeld' }, { status: 409 })
    }

    // Step 1: Create end-user agreement
    const agreement = await createAgreement(institution_id)

    // Step 2: Create requisition with redirect URL
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'}/api/bank/callback`
    const reference = randomUUID().replace(/-/g, '').slice(0, 24)

    const requisition = await createRequisition(
      institution_id,
      agreement.id,
      redirectUrl,
      reference
    )

    // Step 3: Save connection to database
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 90) // 90 day PSD2 consent

    await supabase.from('bank_connections').insert({
      user_id: user.id,
      institution_id,
      institution_name,
      institution_logo: institution_logo || null,
      requisition_id: requisition.id,
      agreement_id: agreement.id,
      status: 'pending',
      access_valid_until: validUntil.toISOString()
    })

    // Return the bank auth URL for the frontend to redirect to
    return NextResponse.json({
      link: requisition.link,
      requisition_id: requisition.id
    })
  } catch (error) {
    console.error('[Bank] Connect error:', error)
    return NextResponse.json({ error: 'Kon bankverbinding niet starten' }, { status: 500 })
  }
}
