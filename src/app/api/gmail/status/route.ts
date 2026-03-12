import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('gmail_accounts').select('email, expires_at, last_scanned, full_scan_complete').eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const accounts = (data || []).map((a: { email: string; expires_at: number; last_scanned: string | null; full_scan_complete: boolean | null }) => ({
      email: a.email, connected: true, expired: Date.now() > a.expires_at,
      lastScanned: a.last_scanned, fullScanComplete: a.full_scan_complete ?? false,
    }))
    return NextResponse.json({ accounts })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 }) }
}
