import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'
const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const DEADLINE = Date.now() + 8000; const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }
  try {
    const userId = await getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE })
    const supabase = getSupabaseAdmin(); const billId = params.id; guard()
    const body = await req.json()
    const { data: current, error: fetchErr } = await supabase.from('bills').select('status').eq('id', billId).eq('user_id', userId).single()
    if (fetchErr || !current) return NextResponse.json({ error: 'Bill not found' }, { status: 404, headers: NO_CACHE })
    guard()
    const allowedFields = ['status','paid_at','notes','assigned_to','category','amount','due_date','reference','iban','requires_review','proof_of_payment','payment_url','vendor_contact','checklist','email_drafts']
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) { if (body[field] !== undefined) update[field] = body[field] }
    if (body.status === 'settled' && !body.paid_at) update.paid_at = new Date().toISOString()
    if (body.status === 'outstanding' && current.status === 'settled') update.paid_at = null
    guard()
    const { data, error } = await supabase.from('bills').update(update).eq('id', billId).eq('user_id', userId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE })
    return NextResponse.json({ data }, { headers: NO_CACHE })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') return NextResponse.json({ error: 'TIMEOUT_ABORT' }, { status: 408, headers: NO_CACHE })
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE })
  }
}
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE })
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('bills').delete().eq('id', params.id).eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE })
    return NextResponse.json({ success: true }, { headers: NO_CACHE })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE })
  }
}
