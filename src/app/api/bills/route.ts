import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_USER_ID } from '@/lib/supabase-server'
import { computeBillHash, validateIBAN } from '@/lib/hash'
import type { DbBill } from '@/lib/types'

// GET /api/bills — list bills for the current user
export async function GET(req: NextRequest) {
  const DEADLINE = Date.now() + 8000
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }

  try {
    const supabase = getSupabaseAdmin()
    const userId = DEMO_USER_ID // TODO: replace with auth.uid() from NextAuth session

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')   // 'outstanding' | 'settled' | 'all'
    const assignedTo = searchParams.get('assigned_to') // 'mine' | 'partner' | 'joint' | null

    guard()

    let query = supabase
      .from('bills')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      if (status === 'settled') {
        query = query.eq('status', 'settled')
      } else {
        query = query.neq('status', 'settled')
      }
    }

    if (assignedTo && assignedTo !== 'all') {
      query = query.eq('assigned_to', assignedTo)
    }

    guard()
    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [], count: count ?? 0 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'TIMEOUT_ABORT' }, { status: 408 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/bills — create a new bill
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 8000
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }

  try {
    const supabase = getSupabaseAdmin()
    const userId = DEMO_USER_ID

    guard()
    const body = await req.json()

    // Validate required fields
    const { vendor, amount, due_date, received_date, category, assigned_to, source } = body
    if (!vendor || amount === undefined || !due_date || !received_date || !category || !assigned_to) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate IBAN if provided
    let iban = body.iban || null
    let requiresReview = body.requires_review || false
    if (iban) {
      if (!validateIBAN(iban)) {
        iban = null
        requiresReview = true
      }
    }

    guard()

    // Compute dedup hash
    const hash = await computeBillHash(vendor, amount, body.reference || null)

    // Check for duplicate
    const { data: existing } = await supabase
      .from('bills')
      .select('id')
      .eq('user_id', userId)
      .eq('hash', hash)
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'DUPLICATE', existing_id: existing.id },
        { status: 409 }
      )
    }

    guard()

    // Generate nanoid-style ID
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)

    const bill: Partial<DbBill> = {
      id,
      user_id: userId,
      assigned_to,
      vendor,
      amount,
      currency: body.currency || 'EUR',
      iban,
      reference: body.reference || null,
      due_date,
      received_date,
      category,
      status: body.status || 'outstanding',
      source: source || 'manual',
      gmail_message_id: body.gmail_message_id || null,
      hash,
      requires_review: requiresReview,
      notes: body.notes || null,
      proof_of_payment: null,
    }

    const { data, error } = await supabase
      .from('bills')
      .insert(bill)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'TIMEOUT_ABORT' }, { status: 408 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
