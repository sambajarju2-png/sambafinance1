import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { getTransactions, Transaction } from '@/lib/enablebanking'
import { sendPushToUser } from '@/lib/push'
import { log } from '@/lib/logger'

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

    // PW-10: Rate limit — 5 syncs per 5 minutes
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const allowed = await checkRateLimit(user.id, 'bank/sync', 5, 5)
    if (!allowed) {
      return NextResponse.json({ error: 'Te veel verzoeken. Probeer het over een paar minuten opnieuw.' }, { status: 429 })
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
    let totalBillMatches = 0
    const billMatchDetails: Array<{ vendor: string; amount: number; date: string; type: string }> = []

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
            const billMatch = matchBill(tx, bills || [])
            if (billMatch) {
              record.matched_bill_id = billMatch.bill.id
              ;(record as Record<string, unknown>).match_type = billMatch.type
              totalBillMatches++
              billMatchDetails.push({
                vendor: billMatch.bill.vendor,
                amount: Math.abs(record.amount),
                date: record.booking_date || new Date().toISOString().split('T')[0],
                type: billMatch.type,
              })
            }
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

    // Send push notification for new bill matches
    if (billMatchDetails.length > 0) {
      try {
        const first = billMatchDetails[0]
        const amountStr = `€${(first.amount / 100).toFixed(2).replace('.', ',')}`
        const dateStr = new Date(first.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
        const title = first.type === 'partial'
          ? 'Mogelijke betaling gevonden'
          : 'Betaling gevonden'
        const body = billMatchDetails.length === 1
          ? `Het lijkt erop dat je ${first.vendor} van ${amountStr} hebt betaald op ${dateStr}. Klopt dit?`
          : `${billMatchDetails.length} betalingen gevonden die bij je rekeningen passen. Controleer op het Overzicht.`

        await sendPushToUser(user.id, { title, body, url: '/overzicht', tag: 'paywatch-match' })
      } catch { /* notification is non-critical */ }
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

    // PW-09: Run categorization + aggregation + subscription detection fire-and-forget
    // Don't block the sync response — user sees transactions immediately
    const userId = user.id
    Promise.resolve().then(async () => {
      try {
        const { categorizeUserTransactions } = await import('@/lib/analytics/categorizer')
        const catResult = await categorizeUserTransactions(userId)
        log.info('Categorization complete', { userId, categorized: catResult.categorized, aiCalled: catResult.aiCalled })
      } catch (catErr) {
        log.error('Categorization error (background)', { error: catErr instanceof Error ? catErr.message : 'unknown' })
      }
      try {
        // Aggregate transactions → analytics_monthly_totals + analytics_monthly_categories
        const { aggregateAnalytics } = await import('@/lib/analytics/aggregate')
        const aggResult = await aggregateAnalytics(userId)
        log.info('Analytics aggregation complete', { userId, months: aggResult.months, categories: aggResult.categories })
      } catch (aggErr) {
        log.error('Analytics aggregation error (background)', { error: aggErr instanceof Error ? aggErr.message : 'unknown' })
      }
      try {
        await supabase.rpc('detect_recurring_payments', { p_user_id: userId })
      } catch (subErr) {
        log.error('Subscription detection error (background)', { error: subErr instanceof Error ? subErr.message : 'unknown' })
      }
    })

    return NextResponse.json({ success: true, new_transactions: totalNew, matched: totalMatched, bill_matches: totalBillMatches })
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
  // Extract MCC from Enable Banking transaction
  const mcc = tx.merchant_category_code || null

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
    mcc,
    category_source: 'unset',
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
interface BillMatch { bill: Bill; type: 'exact' | 'partial' }

function matchBill(tx: Transaction, bills: Bill[]): BillMatch | null {
  if (!bills.length || tx.credit_debit_indicator !== 'DBIT') return null
  const amt = Math.abs(Math.round(parseFloat(tx.transaction_amount.amount) * 100))
  const credName = (tx.creditor?.name || '').toLowerCase()
  const credIban = (tx.creditor_account?.iban || '').replace(/\s/g, '')
  const desc = (tx.remittance_information?.join(' ') || '').toLowerCase()

  for (const b of bills) {
    const v = b.vendor.toLowerCase()
    const billIban = (b.iban || '').replace(/\s/g, '')
    const vendorMatch = (credName.length > 2 && v.length > 2) &&
      (credName.includes(v) || v.includes(credName))
    const ibanMatch = billIban && credIban && billIban === credIban
    const refMatch = b.id && desc.includes(b.id.slice(-8))

    if (!vendorMatch && !ibanMatch) continue

    const diff = Math.abs(amt - b.amount) / Math.max(b.amount, 1)

    // Exact match: vendor/IBAN + amount within 10%
    if (diff < 0.1) return { bill: b, type: 'exact' }

    // Partial match: vendor/IBAN matches but amount differs (betalingsregeling?)
    // Allow up to 50% difference — user will confirm
    if (diff < 0.5 && (ibanMatch || refMatch || vendorMatch)) {
      return { bill: b, type: 'partial' }
    }
  }
  return null
}
