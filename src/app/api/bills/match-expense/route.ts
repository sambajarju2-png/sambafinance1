import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId, NO_CACHE } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * GET /api/bills/match-expense?vendor=Ziggo
 * Checks if a vendor name matches an existing vaste last.
 * Returns the matching expense if found.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE })

  const vendor = req.nextUrl.searchParams.get('vendor')?.trim()
  if (!vendor || vendor.length < 2) {
    return NextResponse.json({ match: null }, { headers: NO_CACHE })
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Search for expenses that match the vendor name (case-insensitive)
    const { data: expenses } = await supabase
      .from('user_expenses')
      .select('id, name, category, amount, interval, monthly_amount, iban')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (!expenses || expenses.length === 0) {
      return NextResponse.json({ match: null }, { headers: NO_CACHE })
    }

    const vendorLower = vendor.toLowerCase()
    const match = expenses.find(e => {
      const name = e.name.toLowerCase()
      return name.includes(vendorLower) || vendorLower.includes(name)
    })

    return NextResponse.json({ match: match || null }, { headers: NO_CACHE })
  } catch {
    return NextResponse.json({ match: null }, { headers: NO_CACHE })
  }
}
