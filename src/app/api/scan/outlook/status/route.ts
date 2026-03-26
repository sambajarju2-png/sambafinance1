/**
 * GET /api/scan/outlook/status?accountId=xxx
 *
 * Returns current scan progress for the given Outlook account.
 * Used by ScanProgress component to check for interrupted scans
 * and to poll progress when background chain is running.
 *
 * File: src/app/api/scan/outlook/status/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAuthUserId } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const accountId = request.nextUrl.searchParams.get('accountId')
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is vereist' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: account } = await supabase
      .from('outlook_accounts')
      .select('scan_cursor, scan_progress, full_scan_complete, last_scanned, scan_locked_until')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Account niet gevonden' }, { status: 404 })
    }

    const isActive = !!(account.scan_cursor && account.scan_progress > 0)
    const isLocked = !!(account.scan_locked_until && new Date(account.scan_locked_until) > new Date())

    return NextResponse.json({
      scan_progress: account.scan_progress || 0,
      scan_cursor: account.scan_cursor,
      full_scan_complete: account.full_scan_complete,
      last_scanned: account.last_scanned,
      is_active: isActive,        // scan in progress (has cursor + progress)
      is_locked: isLocked,        // another invocation is processing right now
      is_background: isActive && isLocked, // background chain is running
    })
  } catch (error) {
    console.error('[Outlook Status] Error:', error)
    return NextResponse.json({ error: 'Status ophalen mislukt' }, { status: 500 })
  }
}
