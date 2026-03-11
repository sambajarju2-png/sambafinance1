// Database types matching the Supabase schema exactly
// Amounts are always in CENTS (integer)

export interface DbBill {
  id: string
  user_id: string
  assigned_to: 'mine' | 'partner' | 'joint'
  vendor: string
  amount: number
  currency: string
  iban: string | null
  reference: string | null
  due_date: string        // YYYY-MM-DD
  received_date: string   // YYYY-MM-DD
  paid_at: string | null  // ISO datetime
  category: string
  status: 'outstanding' | 'action' | 'settled' | 'failed' | 'review'
  source: 'manual' | 'gmail_scan'
  gmail_message_id: string | null
  hash: string
  requires_review: boolean
  notes: string | null
  proof_of_payment: string | null
  created_at: string
  updated_at: string
}

export interface DbUserSettings {
  user_id: string
  current_balance: number
  partner_name: string
  default_currency: string
  notifications_enabled: boolean
  notify_days_before: number
  budgets: Record<string, number>
  created_at: string
  updated_at: string
}

// API response types
export interface BillsResponse {
  data: DbBill[]
  count: number
}

export interface BillResponse {
  data: DbBill
}

export interface ErrorResponse {
  error: string
}
