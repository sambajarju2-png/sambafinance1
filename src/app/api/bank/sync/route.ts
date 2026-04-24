import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { getTransactions, Transaction } from '@/lib/enablebanking'

export async function POST(req: NextRequest) {
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
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const connectionId = body.connection_id

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = supabase
      .from('bank_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'linked')

    if (connectionId) query = query.eq('id', connectionId)

    const { data: connections } = await query

    if (!connections || connections.length === 0) {
      return NextResponse.json({ error: 'Geen gekoppelde bank gevonden' }, { status: 404 })
    }

    // Get expenses + bills for matching
    const { data: expenses } = await supabase
      .from('user_expenses')
      .select('id, name, iban, reference, category')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const { data: bills } = await supabase
      .from('bills')
      .select('id, vendor, amount, iban')
      .eq('user_id', user.id)
      .in('status', ['outstanding', 'action'])

    let totalNew = 0
    let totalMatched = 0

    for (const conn of connections) {
      for (const accountUid of conn.account_ids || []) {
        try {
          const dateFrom = conn.last_synced_at
            ? new Date(new Date(conn.last_synced_at).getTime() - 2 * 86400000).toISOString().split('T')[0]
            : new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

          const txData = await getTransactions(accountUid, dateFrom)
          const txs = txData.transactions || []

          const records = []
          for (const tx of txs) {
            const record = mapTx(tx, user.id, conn.id, accountUid)
            const matchedExp = matchExpense(tx, expenses || [])
            if (matchedExp) {
              record.matched_expense_id = matchedExp.id
              record.pw_category = matchedExp.category
              totalMatched++
            }
            const matchedBill = matchBill(tx, bills || [])
            if (matchedBill) record.matched_bill_id = matchedBill.id
            records.push(record)
          }

          if (records.length > 0) {
            const { data: inserted } = await supabase
              .from('bank_transactions')
              .upsert(records, { onConflict: 'user_id,account_id,transaction_id', ignoreDuplicates: true })
              .select('id')
            totalNew += inserted?.length || 0
          }
        } catch (err) {
          console.error(`[Bank] Sync error for ${accountUid}:`, err)
        }
      }

      await supabase
        .from('bank_connections')
        .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', conn.id)
    }

    // Auto-mark expenses as paid
    if (totalMatched > 0 && expenses) {
      const month = new Date().toISOString().slice(0, 7)
      for (const exp of expenses) {
        const { data: match } = await supabase
          .from('bank_transactions')
          .select('id')
          .eq('matched_expense_id', exp.id)
          .gte('booking_date', `${month}-01`)
          .limit(1)
        if (match?.length) {
          await supabase.from('user_expenses').update({
            last_paid_at: new Date().toISOString(),
            last_paid_month: month
          }).eq('id', exp.id)
        }
      }
    }

    return NextResponse.json({ success: true, new_transactions: totalNew, matched: totalMatched })
  } catch (error) {
    console.error('[Bank] Sync error:', error)
    return NextResponse.json({ error: 'Synchronisatie mislukt' }, { status: 500 })
  }
}

// ─── Mapping & Matching ──────────────────────────────────────

function mapTx(tx: Transaction, userId: string, connId: string, accountUid: string) {
  const amount = Math.round(parseFloat(tx.transaction_amount.amount) * 100)
  const isDebit = tx.credit_debit_indicator === 'DBIT'
  const description = tx.remittance_information?.join(' ') || ''

  return {
    user_id: userId,
    connection_id: connId,
    account_id: accountUid,
    transaction_id: tx.entry_reference || `${tx.booking_date}_${amount}_${tx.creditor?.name || tx.debtor?.name || 'x'}`,
    booking_date: tx.booking_date || tx.transaction_date,
    value_date: tx.value_date || null,
    amount: isDebit ? -Math.abs(amount) : Math.abs(amount),
    currency: tx.transaction_amount.currency,
    creditor_name: tx.creditor?.name || null,
    debtor_name: tx.debtor?.name || null,
    creditor_iban: tx.creditor_account?.iban || null,
    debtor_iban: tx.debtor_account?.iban || null,
    remittance_info: description,
    bank_category: tx.bank_transaction_code?.description || null,
    is_recurring: false,
    raw_data: tx,
    matched_expense_id: null as string | null,
    matched_bill_id: null as string | null,
    pw_category: null as string | null
  }
}

interface Exp { id: string; name: string; iban: string | null; reference: string | null; category: string }

function matchExpense(tx: Transaction, expenses: Exp[]): Exp | null {
  if (!expenses.length) return null
  if (tx.credit_debit_indicator !== 'DBIT') return null

  const credIban = tx.creditor_account?.iban?.replace(/\s/g, '')
  const desc = (tx.remittance_information?.join(' ') || '').toLowerCase()
  const credName = (tx.creditor?.name || '').toLowerCase()

  for (const e of expenses) {
    if (e.iban && credIban && e.iban.replace(/\s/g, '') === credIban) return e
    if (e.reference && desc.includes(e.reference.toLowerCase())) return e
    const n = e.name.toLowerCase()
    if (n.length > 3 && (credName.includes(n) || desc.includes(n))) return e
    if (n.length > 0 && n.length <= 3) {
      const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(credName) || re.test(desc)) return e
    }
  }
  return null
}

interface Bill { id: string; vendor: string; amount: number; iban: string | null }

function matchBill(tx: Transaction, bills: Bill[]): Bill | null {
  if (!bills.length || tx.credit_debit_indicator !== 'DBIT') return null
  const amt = Math.abs(Math.round(parseFloat(tx.transaction_amount.amount) * 100))
  const credName = (tx.creditor?.name || '').toLowerCase()

  for (const b of bills) {
    const v = b.vendor.toLowerCase()
    const diff = Math.abs(amt - b.amount) / b.amount
    if ((credName.includes(v) || v.includes(credName)) && diff < 0.1) return b
  }
  return null
}
