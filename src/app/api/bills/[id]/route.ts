import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_USER_ID } from '@/lib/supabase-server'

// PATCH /api/bills/[id] — update a bill (mark paid, add notes, change status)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const DEADLINE = Date.now() + 8000
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }

  try {
    const supabase = getSupabaseAdmin()
    const userId = DEMO_USER_ID
    const billId = params.id

    guard()
    const body = await req.json()

    // Fetch current bill to enforce state machine
    const { data: current, error: fetchErr } = await supabase
      .from('bills')
      .select('status')
      .eq('id', billId)
      .eq('user_id', userId)
      .single()

    if (fetchErr || !current) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    guard()

    // State machine: settled is terminal — return 409
    if (current.status === 'settled' && body.status && body.status !== 'settled') {
      return NextResponse.json(
        { error: 'Cannot change status of a settled bill' },
        { status: 409 }
      )
    }

    // Build update object — only allow safe fields
    const allowedFields = [
      'status', 'paid_at', 'notes', 'assigned_to', 'category',
      'amount', 'due_date', 'reference', 'iban', 'requires_review',
      'proof_of_payment',
    ]

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        update[field] = body[field]
      }
    }

    // If marking as paid, auto-set paid_at
    if (body.status === 'settled' && !body.paid_at) {
      update.paid_at = new Date().toISOString()
    }

    guard()

    const { data, error } = await supabase
      .from('bills')
      .update(update)
      .eq('id', billId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'TIMEOUT_ABORT' }, { status: 408 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/bills/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const DEADLINE = Date.now() + 8000
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }

  try {
    const supabase = getSupabaseAdmin()
    const userId = DEMO_USER_ID

    guard()

    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', params.id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'TIMEOUT_ABORT' }, { status: 408 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
