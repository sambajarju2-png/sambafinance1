import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSession } from '@/lib/enablebanking'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'

  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&error=no_code`)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find pending connection — by state if available, otherwise most recent
    const { data: connection } = state
      ? await supabase
          .from('bank_connections')
          .select('*')
          .eq('agreement_id', state)
          .eq('status', 'pending')
          .single()
      : await supabase
          .from('bank_connections')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

    if (!connection) {
      return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&error=connection_not_found`)
    }

    // Exchange code for session
    const session = await createSession(code)
    const accountUids = session.accounts.map(a => a.uid)

    await supabase
      .from('bank_connections')
      .update({
        account_ids: accountUids,
        agreement_id: session.session_id,
        status: 'linked',
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&bank=connected`)
  } catch (error) {
    console.error('[Bank] Callback error:', error)
    return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&error=callback_failed`)
  }
}
