import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_USER_ID } from '@/lib/supabase-server'

// GET /api/settings
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', DEMO_USER_ID)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/settings
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json()

    const allowedFields = [
      'partner_name', 'current_balance', 'notifications_enabled',
      'notify_days_before', 'budgets',
    ]

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) update[field] = body[field]
    }

    const { data, error } = await supabase
      .from('user_settings')
      .update(update)
      .eq('user_id', DEMO_USER_ID)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
