import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * GET — list pending matches (matched but not yet confirmed/dismissed)
 * POST — confirm or dismiss a match
 */

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie')
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            if (!cookieHeader) return []
            return cookieHeader.split(';').map(c => {
              const [name, ...rest] = c.trim().split('=')
              return { name, value: rest.join('=') }
            })
          },
          setAll() {}
        }
      }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get transactions that have a matched bill but haven't been confirmed/dismissed
    const { data: matches } = await supabase
      .from('bank_transactions')
      .select('id, creditor_name, creditor_iban, amount, booking_date, remittance_info, matched_bill_id, connection_id, match_type')
      .eq('user_id', user.id)
      .not('matched_bill_id', 'is', null)
      .is('match_status', null)
      .order('booking_date', { ascending: false })

    if (!matches || matches.length === 0) {
      return NextResponse.json({ matches: [] })
    }

    // Get the bill details for each match
    const billIds = [...new Set(matches.map(m => m.matched_bill_id))]
    const { data: bills } = await supabase
      .from('bills')
      .select('id, vendor, amount, status, due_date')
      .in('id', billIds)

    const billMap = new Map((bills || []).map(b => [b.id, b]))

    // Get connection details for bank name
    const connIds = [...new Set(matches.map(m => m.connection_id))]
    const { data: conns } = await supabase
      .from('bank_connections')
      .select('id, institution_name')
      .in('id', connIds)

    const connMap = new Map((conns || []).map(c => [c.id, c]))

    const result = matches
      .filter(m => {
        const bill = billMap.get(m.matched_bill_id)
        return bill && bill.status !== 'settled' // only show if bill isn't already settled
      })
      .map(m => {
        const bill = billMap.get(m.matched_bill_id)!
        const conn = connMap.get(m.connection_id)
        return {
          transaction_id: m.id,
          bill_id: m.matched_bill_id,
          bank_name: conn?.institution_name || 'Bank',
          creditor_name: m.creditor_name,
          creditor_iban: m.creditor_iban,
          tx_amount: m.amount,
          tx_date: m.booking_date,
          tx_description: m.remittance_info,
          bill_vendor: bill.vendor,
          bill_amount: bill.amount,
          bill_due_date: bill.due_date,
          match_type: m.match_type || 'exact',
        }
      })

    return NextResponse.json({ matches: result })
  } catch (error) {
    console.error('[Bank] Matches error:', error)
    return NextResponse.json({ error: 'Kon matches niet ophalen' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { transaction_id, bill_id, action } = await req.json()

    if (!transaction_id || !action) {
      return NextResponse.json({ error: 'transaction_id en action zijn verplicht' }, { status: 400 })
    }

    const cookieHeader = req.headers.get('cookie')
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            if (!cookieHeader) return []
            return cookieHeader.split(';').map(c => {
              const [name, ...rest] = c.trim().split('=')
              return { name, value: rest.join('=') }
            })
          },
          setAll() {}
        }
      }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (action === 'confirm') {
      // Mark transaction as confirmed
      await supabase
        .from('bank_transactions')
        .update({ match_status: 'confirmed' })
        .eq('id', transaction_id)
        .eq('user_id', user.id)

      // Mark the bill as settled
      if (bill_id) {
        await supabase
          .from('bills')
          .update({ status: 'settled', paid_at: new Date().toISOString() })
          .eq('id', bill_id)
          .eq('user_id', user.id)
      }

      return NextResponse.json({ success: true, action: 'confirmed' })
    } else if (action === 'dismiss') {
      // Mark transaction as dismissed (don't change bill)
      await supabase
        .from('bank_transactions')
        .update({ match_status: 'dismissed', matched_bill_id: null })
        .eq('id', transaction_id)
        .eq('user_id', user.id)

      return NextResponse.json({ success: true, action: 'dismissed' })
    }

    return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 })
  } catch (error) {
    console.error('[Bank] Match action error:', error)
    return NextResponse.json({ error: 'Actie mislukt' }, { status: 500 })
  }
}
