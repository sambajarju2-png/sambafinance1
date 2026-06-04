// src/lib/bank-sync.ts
// Shared Enable Banking sync logic, used by both the manual sync route
// (POST /api/bank/sync) and the daily cron (GET /api/cron/bank-sync) so the
// two paths can never drift. This module ONLY fetches + stores transactions,
// matches expenses/bills, marks expenses paid, and flags expired consent.
// Categorization, analytics refresh and subscription detection are run by the
// callers afterwards.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getTransactions, type Transaction } from '@/lib/enablebanking'

export interface BillMatchDetail {
  vendor: string
  amount: number
  date: string
  type: string
}

export interface SyncResult {
  connectionsFound: number
  newTransactions: number
  matched: number
  billMatches: number
  billMatchDetails: BillMatchDetail[]
  expiredConnectionIds: string[]
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Sync all linked Enable Banking connections for a single user.
 * Optionally restrict to one connection via opts.connectionId.
 *
 * Returns aggregated counts. connectionsFound === 0 means the user has no
 * linked connection (caller decides whether that is a 404 or a no-op).
 */
export async function syncUserConnections(
  supabase: SupabaseClient,
  userId: string,
  opts: { connectionId?: string } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    connectionsFound: 0,
    newTransactions: 0,
    matched: 0,
    billMatches: 0,
    billMatchDetails: [],
    expiredConnectionIds: [],
  }

  let query = supabase
    .from('bank_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'linked')

  if (opts.connectionId) query = query.eq('id', opts.connectionId)

  const { data: connections } = await query
  if (!connections || connections.length === 0) return result
  result.connectionsFound = connections.length

  const { data: expenses } = await supabase
    .from('user_expenses')
    .select('id, name, iban, reference, category')
    .eq('user_id', userId)
    .eq('is_active', true)

  const { data: bills } = await supabase
    .from('bills')
    .select('id, vendor, amount, iban')
    .eq('user_id', userId)
    .in('status', ['outstanding', 'action'])

  const now = Date.now()

  for (const conn of connections) {
    const accountIds: string[] = conn.account_ids || []
    if (accountIds.length === 0) continue // orphaned connection — nothing to sync

    // Skip + flag connections whose PSD2 consent has already expired.
    if (conn.access_valid_until && new Date(conn.access_valid_until).getTime() <= now) {
      await markExpired(supabase, conn.id)
      result.expiredConnectionIds.push(conn.id)
      continue
    }

    let connExpired = false

    for (const accountUid of accountIds) {
      try {
        const dateFrom = conn.last_synced_at
          ? new Date(new Date(conn.last_synced_at).getTime() - 2 * 86400000).toISOString().split('T')[0]
          : new Date(now - 90 * 86400000).toISOString().split('T')[0] // 90 days on first sync (PSD2 max)

        // Paginate with continuation_key — without this, accounts with many
        // transactions silently lose data.
        const txs: Transaction[] = []
        let continuationKey: string | undefined
        do {
          const txData = await getTransactions(accountUid, dateFrom, undefined, continuationKey)
          txs.push(...(txData.transactions || []))
          continuationKey = txData.continuation_key || undefined
          if (continuationKey) await new Promise(r => setTimeout(r, 200)) // courtesy delay
        } while (continuationKey)

        const records = []
        for (const tx of txs) {
          const record = mapTx(tx, userId, conn.id, accountUid)

          const matchedExp = matchExpense(tx, expenses || [])
          if (matchedExp) {
            record.matched_expense_id = matchedExp.id
            // user_expenses use the bills taxonomy (energie/huur/telecom/...).
            // Map into the analytics pw_category taxonomy so it isn't shown as "Overig".
            const mapped = mapExpenseCategory(matchedExp.category)
            record.pw_category = mapped.category
            ;(record as Record<string, unknown>).pw_sub_category = mapped.sub
            ;(record as Record<string, unknown>).category_source = 'user'
            ;(record as Record<string, unknown>).category_confidence = 0.95
            ;(record as Record<string, unknown>).merchant_clean_name = tx.creditor?.name || matchedExp.name
            result.matched++
          }

          const billMatch = matchBill(tx, bills || [])
          if (billMatch) {
            record.matched_bill_id = billMatch.bill.id
            ;(record as Record<string, unknown>).match_type = billMatch.type
            result.billMatches++
            result.billMatchDetails.push({
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
          result.newTransactions += inserted?.length || 0
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[BankSync] error for account ${accountUid}:`, msg)
        // Enable Banking returns 401/403 when the session/consent is invalid.
        if (msg.includes(' 401') || msg.includes(' 403')) {
          connExpired = true
          break
        }
      }
    }

    if (connExpired) {
      await markExpired(supabase, conn.id)
      result.expiredConnectionIds.push(conn.id)
      continue // do not bump last_synced_at for an expired connection
    }

    await supabase
      .from('bank_connections')
      .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', conn.id)
  }

  // Auto-mark matched expenses as paid for the current month.
  if (result.matched > 0 && expenses) {
    const month = new Date().toISOString().slice(0, 7)
    for (const exp of expenses) {
      const { data: match } = await supabase
        .from('bank_transactions')
        .select('id')
        .eq('matched_expense_id', exp.id)
        .gte('booking_date', `${month}-01`)
        .limit(1)
      if (match?.length) {
        await supabase
          .from('user_expenses')
          .update({ last_paid_at: new Date().toISOString(), last_paid_month: month })
          .eq('id', exp.id)
      }
    }
  }

  return result
}

async function markExpired(supabase: SupabaseClient, connId: string) {
  await supabase
    .from('bank_connections')
    .update({ status: 'expired', error_message: 'consent_expired', updated_at: new Date().toISOString() })
    .eq('id', connId)
}

// ─── Mapping & Matching ──────────────────────────────────────

// user_expenses / bills use a different taxonomy than bank analytics.
// Translate to the analytics pw_category taxonomy (see lib/analytics/categories.ts).
export function mapExpenseCategory(cat: string | null): { category: string; sub: string | null } {
  const c = (cat || '').toLowerCase().trim()
  const M: Record<string, { category: string; sub: string | null }> = {
    // housing
    huur: { category: 'wonen', sub: 'huur' },
    hypotheek: { category: 'wonen', sub: 'hypotheek' },
    energie: { category: 'wonen', sub: 'energie' },
    water: { category: 'wonen', sub: 'water' },
    gemeentebelasting: { category: 'wonen', sub: 'gemeentebelasting' },
    belasting: { category: 'wonen', sub: 'gemeentebelasting' },
    // fixed costs
    verzekering: { category: 'vaste_lasten', sub: 'verzekering' },
    zorgverzekering: { category: 'vaste_lasten', sub: 'zorgverzekering' },
    telecom: { category: 'vaste_lasten', sub: 'telecom' },
    internet: { category: 'vaste_lasten', sub: 'telecom' },
    // subscriptions
    abonnement: { category: 'abonnementen', sub: null },
    // debt
    incasso: { category: 'schuld', sub: 'incasso' },
    deurwaarder: { category: 'schuld', sub: 'deurwaarder' },
    cjib: { category: 'schuld', sub: 'cjib' },
    boete: { category: 'schuld', sub: 'cjib' },
    belastingschuld: { category: 'schuld', sub: 'belastingschuld' },
    lening: { category: 'schuld', sub: 'lening' },
    // already analytics taxonomy → pass through
    wonen: { category: 'wonen', sub: null },
    vaste_lasten: { category: 'vaste_lasten', sub: null },
    boodschappen: { category: 'boodschappen', sub: null },
    eten_drinken: { category: 'eten_drinken', sub: null },
    vervoer: { category: 'vervoer', sub: null },
    winkelen: { category: 'winkelen', sub: null },
    vrije_tijd: { category: 'vrije_tijd', sub: null },
    zorg: { category: 'zorg', sub: null },
    abonnementen: { category: 'abonnementen', sub: null },
    schuld: { category: 'schuld', sub: null },
  }
  return M[c] || { category: 'onbekend', sub: null }
}

function mapTx(tx: Transaction, userId: string, connId: string, accountUid: string) {
  const amount = Math.round(parseFloat(tx.transaction_amount.amount) * 100)
  const isDebit = tx.credit_debit_indicator === 'DBIT'
  const description = tx.remittance_information?.join(' ') || ''
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
    pw_category: null as string | null,
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
    if (diff < 0.1) return { bill: b, type: 'exact' }
    if (diff < 0.5 && (ibanMatch || refMatch || vendorMatch)) {
      return { bill: b, type: 'partial' }
    }
  }
  return null
}
