import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { getAccountTransactions, Transaction } from '@/lib/gocardless'

/**
 * Sync bank transactions for a user.
 * - Fetches transactions from the last 30 days (or since last sync)
 * - Stores new transactions in bank_transactions table
 * - Auto-matches against user_expenses by IBAN or name
 * - Auto-matches against bills by vendor name
 */
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          setAll(_cookies) {}
        }
      }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const connectionId = body.connection_id // optional: sync specific connection

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get linked connections
    let query = supabase
      .from('bank_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'linked')

    if (connectionId) {
      query = query.eq('id', connectionId)
    }

    const { data: connections } = await query

    if (!connections || connections.length === 0) {
      return NextResponse.json({ error: 'Geen gekoppelde bankrekening gevonden' }, { status: 404 })
    }

    // Get user's expenses for matching
    const { data: expenses } = await supabase
      .from('user_expenses')
      .select('id, name, iban, reference, category')
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Get user's open bills for matching
    const { data: bills } = await supabase
      .from('bills')
      .select('id, vendor, amount, iban')
      .eq('user_id', user.id)
      .in('status', ['outstanding', 'action'])

    let totalNew = 0
    let totalMatched = 0
    const syncResults = []

    for (const conn of connections) {
      for (const accountId of conn.account_ids || []) {
        try {
          // Calculate date range: last 30 days or since last sync
          const dateFrom = conn.last_synced_at
            ? new Date(new Date(conn.last_synced_at).getTime() - 2 * 24 * 60 * 60 * 1000) // 2 day overlap
                .toISOString().split('T')[0]
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

          const dateTo = new Date().toISOString().split('T')[0]

          const txData = await getAccountTransactions(accountId, dateFrom, dateTo)
          const bookedTxs = txData.transactions?.booked || []

          // Process each transaction
          const newTransactions = []
          for (const tx of bookedTxs) {
            const txRecord = mapTransaction(tx, user.id, conn.id, accountId)

            // Auto-match against expenses
            const matchedExpense = matchExpense(tx, expenses || [])
            if (matchedExpense) {
              txRecord.matched_expense_id = matchedExpense.id
              txRecord.pw_category = matchedExpense.category
              totalMatched++
            }

            // Auto-match against bills
            const matchedBill = matchBill(tx, bills || [])
            if (matchedBill) {
              txRecord.matched_bill_id = matchedBill.id
            }

            newTransactions.push(txRecord)
          }

          if (newTransactions.length > 0) {
            // Upsert transactions (skip duplicates via unique constraint)
            const { data: inserted } = await supabase
              .from('bank_transactions')
              .upsert(newTransactions, {
                onConflict: 'user_id,account_id,transaction_id',
                ignoreDuplicates: true
              })
              .select('id')

            totalNew += inserted?.length || 0
          }

          syncResults.push({
            account_id: accountId,
            institution: conn.institution_name,
            transactions_found: bookedTxs.length,
            new_stored: newTransactions.length
          })

        } catch (err) {
          console.error(`[Bank] Sync error for account ${accountId}:`, err)
          syncResults.push({
            account_id: accountId,
            institution: conn.institution_name,
            error: 'Synchronisatie mislukt'
          })
        }
      }

      // Update last synced timestamp
      await supabase
        .from('bank_connections')
        .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', conn.id)
    }

    // Mark matched expenses as paid this month
    if (totalMatched > 0 && expenses) {
      const currentMonth = new Date().toISOString().slice(0, 7) // "2026-04"
      for (const expense of expenses) {
        // Check if any transaction matched this expense this month
        const { data: matchedTx } = await supabase
          .from('bank_transactions')
          .select('id, booking_date')
          .eq('matched_expense_id', expense.id)
          .gte('booking_date', `${currentMonth}-01`)
          .limit(1)

        if (matchedTx && matchedTx.length > 0) {
          await supabase
            .from('user_expenses')
            .update({
              last_paid_at: new Date().toISOString(),
              last_paid_month: currentMonth
            })
            .eq('id', expense.id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      new_transactions: totalNew,
      matched: totalMatched,
      results: syncResults
    })
  } catch (error) {
    console.error('[Bank] Sync error:', error)
    return NextResponse.json({ error: 'Synchronisatie mislukt' }, { status: 500 })
  }
}

// ─── Transaction Mapping ─────────────────────────────────────

function mapTransaction(
  tx: Transaction,
  userId: string,
  connectionId: string,
  accountId: string
) {
  const amount = Math.round(parseFloat(tx.transactionAmount.amount) * 100)
  const description = tx.remittanceInformationUnstructured
    || tx.remittanceInformationStructured
    || ''

  return {
    user_id: userId,
    connection_id: connectionId,
    account_id: accountId,
    transaction_id: tx.transactionId || `${tx.bookingDate}_${amount}_${tx.creditorName || tx.debtorName || 'unknown'}`,
    booking_date: tx.bookingDate,
    value_date: tx.valueDate || null,
    amount,
    currency: tx.transactionAmount.currency,
    creditor_name: tx.creditorName || null,
    debtor_name: tx.debtorName || null,
    creditor_iban: tx.creditorAccount?.iban || null,
    debtor_iban: tx.debtorAccount?.iban || null,
    remittance_info: description,
    bank_category: tx.bankTransactionCode || tx.proprietaryBankTransactionCode || null,
    is_recurring: false,
    raw_data: tx
  }
}

// ─── Auto-Matching ───────────────────────────────────────────

interface ExpenseMatch {
  id: string
  name: string
  iban: string | null
  reference: string | null
  category: string
}

function matchExpense(tx: Transaction, expenses: ExpenseMatch[]): ExpenseMatch | null {
  if (expenses.length === 0) return null

  // Only match outgoing payments (negative amounts)
  const amount = parseFloat(tx.transactionAmount.amount)
  if (amount >= 0) return null

  const creditorIban = tx.creditorAccount?.iban?.replace(/\s/g, '')
  const description = (tx.remittanceInformationUnstructured || '').toLowerCase()
  const creditorName = (tx.creditorName || '').toLowerCase()

  for (const expense of expenses) {
    // Match by IBAN (strongest signal)
    if (expense.iban && creditorIban) {
      const expenseIban = expense.iban.replace(/\s/g, '')
      if (expenseIban === creditorIban) return expense
    }

    // Match by reference in payment description
    if (expense.reference && description.includes(expense.reference.toLowerCase())) {
      return expense
    }

    // Match by expense name in creditor name or description
    const expenseName = expense.name.toLowerCase()
    if (expenseName.length > 3) { // avoid false positives on short names
      if (creditorName.includes(expenseName) || description.includes(expenseName)) {
        return expense
      }
    } else if (expenseName.length > 0) {
      // Short names: use word boundary matching
      const regex = new RegExp(`\\b${expenseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(creditorName) || regex.test(description)) {
        return expense
      }
    }
  }

  return null
}

interface BillMatch {
  id: string
  vendor: string
  amount: number
  iban: string | null
}

function matchBill(tx: Transaction, bills: BillMatch[]): BillMatch | null {
  if (bills.length === 0) return null

  const amount = parseFloat(tx.transactionAmount.amount)
  if (amount >= 0) return null // only match debits

  const txAmountCents = Math.abs(Math.round(amount * 100))
  const creditorName = (tx.creditorName || '').toLowerCase()
  const creditorIban = tx.creditorAccount?.iban?.replace(/\s/g, '')

  for (const bill of bills) {
    const vendorName = bill.vendor.toLowerCase()

    // Match by vendor name + similar amount (within 10%)
    const amountDiff = Math.abs(txAmountCents - bill.amount) / bill.amount
    const nameMatch = creditorName.includes(vendorName) || vendorName.includes(creditorName)
    const ibanMatch = bill.iban && creditorIban && bill.iban.replace(/\s/g, '') === creditorIban

    if ((nameMatch || ibanMatch) && amountDiff < 0.1) {
      return bill
    }
  }

  return null
}
