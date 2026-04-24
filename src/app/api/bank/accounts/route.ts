import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { getAccountDetails, getAccountBalances } from '@/lib/gocardless'

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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          setAll(_cookies) {}
        }
      }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all bank connections for this user
    const { data: connections } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!connections || connections.length === 0) {
      return NextResponse.json({ connections: [], accounts: [] })
    }

    // For linked connections, fetch account details and balances
    const accounts = []
    for (const conn of connections) {
      if (conn.status === 'linked' && conn.account_ids?.length > 0) {
        for (const accountId of conn.account_ids) {
          try {
            const [detailsRes, balancesRes] = await Promise.allSettled([
              getAccountDetails(accountId),
              getAccountBalances(accountId)
            ])

            const details = detailsRes.status === 'fulfilled' ? detailsRes.value.account : null
            const balances = balancesRes.status === 'fulfilled' ? balancesRes.value.balances : []

            // Find the "expected" balance (available funds)
            const availableBalance = balances.find(
              (b: { balanceType: string }) => b.balanceType === 'expected' || b.balanceType === 'interimAvailable'
            ) || balances[0]

            accounts.push({
              account_id: accountId,
              connection_id: conn.id,
              institution_name: conn.institution_name,
              institution_logo: conn.institution_logo,
              iban: details?.iban || 'Onbekend',
              owner_name: details?.ownerName || '',
              balance: availableBalance ? {
                amount: Math.round(parseFloat(availableBalance.balanceAmount.amount) * 100),
                currency: availableBalance.balanceAmount.currency,
                date: availableBalance.referenceDate
              } : null,
              status: conn.status,
              last_synced: conn.last_synced_at,
              valid_until: conn.access_valid_until
            })
          } catch (err) {
            console.error(`[Bank] Error fetching account ${accountId}:`, err)
            accounts.push({
              account_id: accountId,
              connection_id: conn.id,
              institution_name: conn.institution_name,
              institution_logo: conn.institution_logo,
              iban: 'Fout bij ophalen',
              owner_name: '',
              balance: null,
              status: 'error',
              last_synced: conn.last_synced_at,
              valid_until: conn.access_valid_until
            })
          }
        }
      }
    }

    return NextResponse.json({
      connections: connections.map(c => ({
        id: c.id,
        institution_name: c.institution_name,
        institution_logo: c.institution_logo,
        status: c.status,
        account_count: c.account_ids?.length || 0,
        last_synced: c.last_synced_at,
        valid_until: c.access_valid_until,
        error: c.error_message
      })),
      accounts
    })
  } catch (error) {
    console.error('[Bank] Accounts error:', error)
    return NextResponse.json({ error: 'Kon bankgegevens niet ophalen' }, { status: 500 })
  }
}
