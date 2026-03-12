import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data: gmailData } = await supabase.from('gmail_accounts').select('user_id, email, expires_at')
    const { data: userData } = await supabase.auth.admin.listUsers()
    const users = (userData?.users || []).map(u => ({
      id: u.id,
      email: u.email,
      last_sign_in: u.last_sign_in_at,
      gmail_accounts: (gmailData || []).filter(g => g.user_id === u.id).map(g => g.email),
    }))
    return NextResponse.json({
      users,
      gmail_accounts_total: gmailData?.length || 0,
      auth_users_total: userData?.users?.length || 0,
      help: 'Compare the userId from /api/gmail/status debug output with the user ids listed here',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}
