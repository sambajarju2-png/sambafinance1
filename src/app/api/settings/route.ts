import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'

// GET /api/settings
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
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
    const userId = await getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const body = await req.json()

    const allowedFields = [
      'partner_name', 'current_balance', 'notifications_enabled',
      'notify_days_before', 'budgets', 'anthropic_api_key',
    ]

    const update: Record<string, unknown> = { 
      user_id: userId,
      updated_at: new Date().toISOString() 
    }
    for (const field of allowedFields) {
      if (body[field] !== undefined) update[field] = body[field]
    }

    // Use upsert to create the row if it doesn't exist
    const { data, error } = await supabase
      .from('user_settings')
      .upsert(update, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('[v0] Settings upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[v0] Settings PATCH error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
