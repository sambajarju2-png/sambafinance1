/**
 * GoCardless Bank Account Data API Client
 * 
 * Handles authentication, token management, and all API calls
 * for PSD2 open banking integration.
 * 
 * Base URL: https://bankaccountdata.gocardless.com/api/v2/
 * Rate limit: 4 API calls per day per account per endpoint
 */

import { createClient } from '@supabase/supabase-js'

const BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2'
const SECRET_ID = process.env.GOCARDLESS_SECRET_ID!
const SECRET_KEY = process.env.GOCARDLESS_SECRET_KEY!

// Supabase admin client for token storage
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Token Management ───────────────────────────────────────

interface TokenData {
  access: string
  access_expires: number  // seconds
  refresh: string
  refresh_expires: number // seconds
}

/**
 * Get a valid access token, refreshing if needed.
 * Tokens are cached in Supabase gocardless_tokens table.
 */
export async function getAccessToken(): Promise<string> {
  const supabase = getAdminClient()

  // Check for cached token
  const { data: cached } = await supabase
    .from('gocardless_tokens')
    .select('*')
    .eq('id', 'default')
    .single()

  if (cached) {
    const accessExpiry = new Date(cached.access_expires)
    const refreshExpiry = new Date(cached.refresh_expires)
    const now = new Date()

    // Access token still valid (with 5min buffer)
    if (accessExpiry.getTime() - 300000 > now.getTime()) {
      return cached.access_token
    }

    // Access expired but refresh token still valid
    if (refreshExpiry.getTime() > now.getTime()) {
      const refreshed = await refreshAccessToken(cached.refresh_token)
      await saveTokens(supabase, {
        access: refreshed.access,
        access_expires: refreshed.access_expires,
        refresh: cached.refresh_token,
        refresh_expires: Math.floor((refreshExpiry.getTime() - now.getTime()) / 1000)
      })
      return refreshed.access
    }
  }

  // No valid token — create new
  const newToken = await createNewToken()
  await saveTokens(supabase, newToken)
  return newToken.access
}

async function createNewToken(): Promise<TokenData> {
  const res = await fetch(`${BASE_URL}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret_id: SECRET_ID,
      secret_key: SECRET_KEY
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GoCardless token creation failed: ${err}`)
  }

  return res.json()
}

async function refreshAccessToken(refreshToken: string): Promise<{ access: string; access_expires: number }> {
  const res = await fetch(`${BASE_URL}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken })
  })

  if (!res.ok) {
    throw new Error('GoCardless token refresh failed')
  }

  return res.json()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveTokens(supabase: any, tokens: TokenData) {
  const now = new Date()
  await supabase.from('gocardless_tokens').upsert({
    id: 'default',
    access_token: tokens.access,
    refresh_token: tokens.refresh,
    access_expires: new Date(now.getTime() + tokens.access_expires * 1000).toISOString(),
    refresh_expires: new Date(now.getTime() + tokens.refresh_expires * 1000).toISOString(),
    updated_at: now.toISOString()
  })
}

// ─── API Helpers ─────────────────────────────────────────────

async function gcFetch(path: string, options: RequestInit = {}) {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[GoCardless] ${options.method || 'GET'} ${path} → ${res.status}:`, errorText)
    throw new Error(`GoCardless API error ${res.status}: ${errorText}`)
  }

  return res.json()
}

// ─── Institutions ────────────────────────────────────────────

export interface Institution {
  id: string             // e.g. 'ING_INGBNL2A'
  name: string           // e.g. 'ING'
  bic: string
  transaction_total_days: string
  countries: string[]
  logo: string
}

/**
 * List available banks for a country (default: NL)
 */
export async function listInstitutions(country = 'NL'): Promise<Institution[]> {
  return gcFetch(`/institutions/?country=${country}`)
}

// ─── End-User Agreements ─────────────────────────────────────

export interface Agreement {
  id: string
  created: string
  institution_id: string
  max_historical_days: number
  access_valid_for_days: number
  access_scope: string[]
}

/**
 * Create an end-user agreement for a specific bank.
 * - max 90 days history (PSD2 standard)
 * - valid for 90 days
 * - scope: balances + details + transactions
 */
export async function createAgreement(institutionId: string): Promise<Agreement> {
  return gcFetch('/agreements/enduser/', {
    method: 'POST',
    body: JSON.stringify({
      institution_id: institutionId,
      max_historical_days: '90',
      access_valid_for_days: '90',
      access_scope: ['balances', 'details', 'transactions']
    })
  })
}

// ─── Requisitions ────────────────────────────────────────────

export interface Requisition {
  id: string
  created: string
  redirect: string
  status: string        // CR=created, LN=linked, EX=expired, etc.
  institution_id: string
  agreement: string
  reference: string
  accounts: string[]
  link: string          // URL to send user to for bank auth
}

/**
 * Create a requisition (bank connection request).
 * Returns a link the user must visit to authorize.
 */
export async function createRequisition(
  institutionId: string,
  agreementId: string,
  redirectUrl: string,
  reference: string
): Promise<Requisition> {
  return gcFetch('/requisitions/', {
    method: 'POST',
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
      agreement: agreementId,
      reference,
      user_language: 'NL'
    })
  })
}

/**
 * Get requisition status and linked accounts.
 */
export async function getRequisition(requisitionId: string): Promise<Requisition> {
  return gcFetch(`/requisitions/${requisitionId}/`)
}

/**
 * Delete a requisition (disconnect).
 */
export async function deleteRequisition(requisitionId: string): Promise<void> {
  const token = await getAccessToken()
  await fetch(`${BASE_URL}/requisitions/${requisitionId}/`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
}

// ─── Account Data ────────────────────────────────────────────

export interface AccountDetails {
  resourceId: string
  iban: string
  currency: string
  ownerName: string
  name: string
  product: string
  cashAccountType: string
}

export interface Balance {
  balanceAmount: { amount: string; currency: string }
  balanceType: string
  referenceDate: string
}

export interface Transaction {
  transactionId: string
  bookingDate: string
  valueDate?: string
  transactionAmount: { amount: string; currency: string }
  creditorName?: string
  creditorAccount?: { iban?: string }
  debtorName?: string
  debtorAccount?: { iban?: string }
  remittanceInformationUnstructured?: string
  remittanceInformationStructured?: string
  bankTransactionCode?: string
  proprietaryBankTransactionCode?: string
}

/**
 * Get account details (IBAN, owner name, etc.)
 */
export async function getAccountDetails(accountId: string): Promise<{ account: AccountDetails }> {
  return gcFetch(`/accounts/${accountId}/details/`)
}

/**
 * Get account balances.
 */
export async function getAccountBalances(accountId: string): Promise<{ balances: Balance[] }> {
  return gcFetch(`/accounts/${accountId}/balances/`)
}

/**
 * Get account transactions.
 * Optional date_from and date_to (YYYY-MM-DD format).
 */
export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ transactions: { booked: Transaction[]; pending: Transaction[] } }> {
  let path = `/accounts/${accountId}/transactions/`
  const params = new URLSearchParams()
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  if (params.toString()) path += `?${params.toString()}`

  return gcFetch(path)
}

/**
 * Get account metadata (status, institution, etc.)
 */
export async function getAccountMetadata(accountId: string) {
  return gcFetch(`/accounts/${accountId}/`)
}
