/**
 * POST /api/auth/outlook/disconnect
 * 
 * Disconnects an Outlook account. Bills already scanned remain.
 * 
 * File: src/app/api/auth/outlook/disconnect/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAuthUserId } from '@/lib/auth'
import { verifyCsrf } from '@/lib/csrf'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await verifyCsrf()
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const { accountId } = await request.json()

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is vereist' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: account, error: fetchError } = await supabase
      .from('outlook_accounts')
      .select('id, email')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !account) {
      return NextResponse.json({ error: 'Account niet gevonden' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('outlook_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('[Outlook Disconnect] Delete failed:', deleteError)
      return NextResponse.json({ error: 'Kon account niet ontkoppelen' }, { status: 500 })
    }

    console.log(`[Outlook Disconnect] Disconnected ${account.email} for user ${userId}`)

    return NextResponse.json({ success: true, email: account.email })
  } catch (error) {
    console.error('[Outlook Disconnect] Unexpected error:', error)
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}
