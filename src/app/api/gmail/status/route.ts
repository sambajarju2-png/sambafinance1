import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/gmail/status — check Gmail connection status
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('gmail_accounts')
      .select('email, expires_at, last_scanned')
      .eq('user_id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const accounts = (data || []).map((a: { email: string; expires_at: number; last_scanned: string | null }) => ({
      email: a.email,
      connected: true,
      expired: Date.now() > a.expires_at,
      lastScanned: a.last_scanned,
    }))

    return NextResponse.json({ accounts })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
