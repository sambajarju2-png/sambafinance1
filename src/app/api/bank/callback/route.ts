import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSession } from '@/lib/enablebanking'

/**
 * Enable Banking redirects here after bank authorization.
 * URL: /api/bank/callback?code=XXX&state=YYY
 */
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

    // Find the pending connection by state
    let connectionQuery = supabase
      .from('bank_connections')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)

    if (state) {
      connectionQuery = supabase
        .from('bank_connections')
        .select('*')
        .eq('agreement_id', state)
        .eq('status', 'pending')
        .single()
    }

    const { data: connection } = state
      ? await connectionQuery
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

    // Exchange code for session — get accounts
    const session = await createSession(code)

    // Extract account UIDs
    const accountUids = session.accounts.map(a => a.uid)

    // Update connection with session and accounts
    await supabase
      .from('bank_connections')
      .update({
        account_ids: accountUids,
        agreement_id: session.session_id,  // store session_id for later use
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
