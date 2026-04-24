import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRequisition } from '@/lib/gocardless'

/**
 * GoCardless redirects here after bank authorization.
 * URL: /api/bank/callback?ref=REQUISITION_ID
 * 
 * The requisition ID is embedded in the redirect URL by GoCardless.
 * We look it up, fetch the linked accounts, and update the connection.
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'

  try {
    const { searchParams } = new URL(req.url)
    const ref = searchParams.get('ref')

    if (!ref) {
      // GoCardless sends ref as the requisition reference
      // Sometimes it's in different params, try to extract requisition from the URL
      return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&error=missing_ref`)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find the bank connection by reference or requisition_id
    // GoCardless may send back the reference we provided
    let connection = null

    // Try by requisition_id first
    const { data: byReqId } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('requisition_id', ref)
      .single()

    if (byReqId) {
      connection = byReqId
    } else {
      // Try to find a pending connection for the user (fallback)
      const { data: pending } = await supabase
        .from('bank_connections')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      connection = pending
    }

    if (!connection) {
      return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&error=connection_not_found`)
    }

    // Fetch the requisition from GoCardless to get account IDs
    const requisition = await getRequisition(connection.requisition_id)

    if (requisition.status === 'LN' && requisition.accounts.length > 0) {
      // Successfully linked — save account IDs
      await supabase
        .from('bank_connections')
        .update({
          account_ids: requisition.accounts,
          status: 'linked',
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)

      return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&bank=connected`)
    } else if (requisition.status === 'EX') {
      await supabase
        .from('bank_connections')
        .update({ status: 'expired', error_message: 'Bankverbinding verlopen' })
        .eq('id', connection.id)

      return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&error=expired`)
    } else if (requisition.status === 'RJ') {
      await supabase
        .from('bank_connections')
        .update({ status: 'error', error_message: 'Bankverbinding geweigerd' })
        .eq('id', connection.id)

      return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&error=rejected`)
    } else {
      // Status is CR (created) or GA (granting access) — might still be processing
      // Update what we have and let the user know
      await supabase
        .from('bank_connections')
        .update({
          account_ids: requisition.accounts || [],
          status: requisition.accounts?.length > 0 ? 'linked' : 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)

      const redirectStatus = requisition.accounts?.length > 0 ? 'bank=connected' : 'bank=pending'
      return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&${redirectStatus}`)
    }
  } catch (error) {
    console.error('[Bank] Callback error:', error)
    return NextResponse.redirect(`${appUrl}/instellingen?tab=bank&error=callback_failed`)
  }
}
