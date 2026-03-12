import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('gmail_accounts').select('user_id, email, expires_at, last_scanned')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      count: data?.length || 0,
      accounts: data?.map(a => ({ user_id: a.user_id, email: a.email, expires_at: a.expires_at, expired: Date.now() > a.expires_at })),
      timestamp: Date.now(),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}
