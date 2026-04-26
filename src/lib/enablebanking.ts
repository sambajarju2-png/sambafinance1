/**
 * Enable Banking API Client
 * 
 * PSD2 open banking integration for reading Dutch bank accounts.
 * Uses JWT auth signed with RSA private key.
 * 
 * API: https://api.enablebanking.com
 * Docs: https://enablebanking.com/docs/api/reference/
 */

import { createSign } from 'crypto'

const API_BASE = 'https://api.enablebanking.com'
const APP_ID = process.env.ENABLEBANKING_APP_ID || '739df3e0-01dc-4bc6-b779-bd7e2dbbd495'

// ─── JWT Generation ──────────────────────────────────────────

function base64url(data: string): string {
  return Buffer.from(data).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function getPrivateKey(): string {
  const b64 = process.env.ENABLEBANKING_PRIVATE_KEY_BASE64
  if (b64) {
    return Buffer.from(b64, 'base64').toString('utf-8')
  }
  throw new Error('ENABLEBANKING_PRIVATE_KEY_BASE64 env var not set')
}

/**
 * Generate a JWT signed with the RSA private key.
 * Enable Banking expects:
 * - header: { alg: "RS256", typ: "JWT", kid: APPLICATION_ID }
 * - payload: { iss: APPLICATION_ID, aud: "enablebanking.com", iat, exp }
 */
function generateJWT(): string {
  const privateKey = getPrivateKey()
  const now = Math.floor(Date.now() / 1000)

  const header = base64url(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
    kid: APP_ID
  }))

  const payload = base64url(JSON.stringify({
    iss: APP_ID,
    aud: 'api.enablebanking.com',
    iat: now,
    exp: now + 3600
  }))

  const signingInput = `${header}.${payload}`
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `${header}.${payload}.${signature}`
}

// ─── API Helpers ─────────────────────────────────────────────

async function ebFetch(path: string, options: RequestInit = {}) {
  const jwt = generateJWT()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
      ...options.headers
    }
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[EnableBanking] ${options.method || 'GET'} ${path} → ${res.status}:`, errorText)
    throw new Error(`Enable Banking API error ${res.status}: ${errorText}`)
  }

  return res.json()
}

// ─── ASPSPs (Banks) ──────────────────────────────────────────

export interface ASPSP {
  name: string
  country: string
  logo?: string
  bic?: string
  psu_types?: string[]
}

/**
 * List available banks for a country (default: NL)
 */
export async function listBanks(country = 'NL'): Promise<ASPSP[]> {
  const res = await ebFetch(`/aspsps?country=${country}`)
  return res.aspsps || []
}

// ─── Authorization ───────────────────────────────────────────

export interface AuthResponse {
  url: string                 // redirect URL for user to visit
  authorization_id: string    // save this to match the callback
  psu_id_hash?: string
}

/**
 * Start bank authorization.
 * User will be redirected to the bank for SCA, then back to redirectUrl.
 */
export async function startAuth(
  bankName: string,
  country: string,
  redirectUrl: string,
  state: string
): Promise<AuthResponse> {
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 90)

  return ebFetch('/auth', {
    method: 'POST',
    body: JSON.stringify({
      access: {
        balances: true,
        transactions: true,
        valid_until: validUntil.toISOString()
      },
      aspsp: {
        name: bankName,
        country: country
      },
      psu_type: 'personal',
      redirect_url: redirectUrl,
      state
    })
  })
}

// ─── Sessions ────────────────────────────────────────────────

export interface SessionAccount {
  account_id: { iban?: string; identification?: string }
  name?: string
  currency?: string
  cash_account_type?: string
  uid: string
  identification_hash?: string
  usage?: string
}

export interface SessionResponse {
  session_id: string
  accounts: SessionAccount[]
}

/**
 * Exchange authorization code for a session.
 * Called after bank redirects back with ?code=XXX.
 */
export async function createSession(code: string): Promise<SessionResponse> {
  return ebFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify({ code })
  })
}

/**
 * Get session details (accounts list).
 */
export async function getSession(sessionId: string): Promise<SessionResponse> {
  return ebFetch(`/sessions/${sessionId}`)
}

/**
 * Delete session (revoke consent).
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const jwt = generateJWT()
  await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${jwt}` }
  })
}

// ─── Account Data ────────────────────────────────────────────

export interface Balance {
  balance_amount: { amount: string; currency: string }
  balance_type: string
  reference_date?: string
  name?: string
}

export interface Transaction {
  transaction_amount: { amount: string; currency: string }
  credit_debit_indicator: string // 'CRDT' or 'DBIT'
  booking_date?: string
  value_date?: string
  transaction_date?: string
  status?: string
  creditor?: { name?: string }
  creditor_account?: { iban?: string }
  debtor?: { name?: string }
  debtor_account?: { iban?: string }
  remittance_information?: string[]
  entry_reference?: string
  bank_transaction_code?: { code?: string; description?: string }
  merchant_category_code?: string
}

export interface TransactionsResponse {
  transactions: Transaction[]
  continuation_key?: string
}

/**
 * Get account balances.
 */
export async function getBalances(accountUid: string): Promise<{ balances: Balance[] }> {
  return ebFetch(`/accounts/${accountUid}/balances`)
}

/**
 * Get account transactions.
 * Optional date_from and date_to (YYYY-MM-DD).
 * Use continuation_key for pagination.
 */
export async function getTransactions(
  accountUid: string,
  dateFrom?: string,
  dateTo?: string,
  continuationKey?: string
): Promise<TransactionsResponse> {
  const params = new URLSearchParams()
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  if (continuationKey) params.set('continuation_key', continuationKey)

  const qs = params.toString()
  return ebFetch(`/accounts/${accountUid}/transactions${qs ? `?${qs}` : ''}`)
}
