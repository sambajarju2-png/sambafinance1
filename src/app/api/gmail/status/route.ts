import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'
export const dynamic = 'force-dynamic'
const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' }
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized', debug: 'getAuthUserId returned null' }, { status: 401, headers: NO_CACHE })
    const supabase = getSupabaseAdmin()
    const { data, error, count } = await supabase.from('gmail_accounts').select('email, expires_at, last_scanned, full_scan_complete', { count: 'exact' }).eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message, debug: `query failed for userId: ${userId}` }, { status: 500, headers: NO_CACHE })
    const accounts = (data || []).map((a: { email: string; expires_at: number; last_scanned: string | null; full_scan_complete: boolean | null }) => ({
      email: a.email, connected: true, expired: Date.now() > a.expires_at,
      lastScanned: a.last_scanned, fullScanComplete: a.full_scan_complete ?? false,
    }))
    return NextResponse.json({ accounts, _debug: { userId, rowCount: count, dataLen: data?.length } }, { headers: NO_CACHE })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: NO_CACHE }) }
}
