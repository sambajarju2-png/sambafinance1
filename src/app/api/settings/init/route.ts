import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

// POST /api/settings/init — create default settings for a new user
export async function POST(req: NextRequest) {
  try {
    const { user_id, name } = await req.json()
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id,
        partner_name: 'Partner',
        budgets: {
          Zakelijk: 250000,
          Energie: 25000,
          Telecom: 8000,
          Lease: 20000,
          Verzekering: 10000,
          Abonnement: 5000,
          Software: 5000,
          Overig: 10000,
        },
      }, { onConflict: 'user_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
