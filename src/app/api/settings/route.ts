import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'
const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' }
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE })
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE })
    return NextResponse.json({ data }, { headers: NO_CACHE })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: NO_CACHE }) }
}
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE })
    const supabase = getSupabaseAdmin(); const body = await req.json()
    const allowedFields = ['partner_name','current_balance','notifications_enabled','notify_days_before','budgets','anthropic_api_key']
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) { if (body[field] !== undefined) update[field] = body[field] }
    const { data, error } = await supabase.from('user_settings').update(update).eq('user_id', userId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE })
    return NextResponse.json({ data }, { headers: NO_CACHE })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: NO_CACHE }) }
}
