export interface DbBill {
  id: string; user_id: string; assigned_to: 'mine' | 'partner' | 'joint'; vendor: string
  amount: number; currency: string; iban: string | null; reference: string | null
  due_date: string; received_date: string; paid_at: string | null; category: string
  status: 'outstanding' | 'action' | 'settled' | 'failed' | 'review'
  source: 'manual' | 'gmail_scan'; gmail_message_id: string | null; hash: string
  requires_review: boolean; notes: string | null; proof_of_payment: string | null
  payment_url: string | null
  vendor_contact: { email?: string; phone?: string; website?: string } | null
  checklist: { text: string; done: boolean; urgent: boolean }[] | null
  email_drafts: { full?: string; plan?: string } | null
  original_email_subject: string | null; original_email_from: string | null
  created_at: string; updated_at: string
}
export interface DbUserSettings {
  user_id: string; current_balance: number; partner_name: string; default_currency: string
  notifications_enabled: boolean; notify_days_before: number; budgets: Record<string, number>
  anthropic_api_key: string | null; created_at: string; updated_at: string
}
export interface BillsResponse { data: DbBill[]; count: number }
export interface BillResponse { data: DbBill }
export interface ErrorResponse { error: string }
