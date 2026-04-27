import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSession } from '@/lib/enablebanking'
import { log } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'

  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code || !state) {
      return NextResponse.redirect(`${appUrl}/bank-callback?status=error&error=no_code`)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // PW-02: Verify state exists, is not expired, and get the bound user_id
    const { data: pendingAuth, error: authError } = await supabase
      .from('pending_bank_auths')
      .select('user_id, institution_name')
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (authError || !pendingAuth) {
      log.warn('Bank callback: invalid or expired state', { state })
      return NextResponse.redirect(`${appUrl}/bank-callback?status=error&error=invalid_state`)
    }

    // PW-02: Consume the state (one-time use)
    await supabase.from('pending_bank_auths').delete().eq('state', state)

    // Find the pending connection for THIS user
    const { data: connection } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('user_id', pendingAuth.user_id)
      .eq('agreement_id', state)
      .eq('status', 'pending')
      .single()

    if (!connection) {
      log.warn('Bank callback: no pending connection found', { userId: pendingAuth.user_id })
      return NextResponse.redirect(`${appUrl}/bank-callback?status=error&error=connection_not_found`)
    }

    // Exchange code for session with Enable Banking
    const session = await createSession(code)
    const accountUids = session.accounts.map((a: { uid: string }) => a.uid)

    await supabase
      .from('bank_connections')
      .update({
        account_ids: accountUids,
        agreement_id: session.session_id,
        status: 'linked',
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)
      .eq('user_id', pendingAuth.user_id)  // PW-03: always fence with user_id

    log.info('Bank connection successful', { userId: pendingAuth.user_id, institution: pendingAuth.institution_name })
    return NextResponse.redirect(`${appUrl}/bank-callback?status=success`)
  } catch (error) {
    log.error('Bank callback error', { error: error instanceof Error ? error.message : 'unknown' })
    return NextResponse.redirect(`${appUrl}/bank-callback?status=error&error=callback_failed`)
  }
}
