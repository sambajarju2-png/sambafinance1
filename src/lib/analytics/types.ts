/**
 * Analytics data types — shared between API and UI
 * File: src/lib/analytics/types.ts
 */

export interface MonthlyCategoryItem {
  month: string;
  category: string;
  sub_category: string | null;
  direction: 'in' | 'out';
  total_cents: number;
  tx_count: number;
}

export interface WeeklyCashflowItem {
  week_start: string;
  income_cents: number;
  expenses_cents: number;
  net_cents: number;
}

export interface MonthlyTotalItem {
  month: string;
  income_cents: number;
  expenses_cents: number;
  net_cents: number;
  debt_payments_cents: number;
}

export interface DebtItem {
  id: string;
  vendor: string;
  amount: number;
  category: string;
  status: string;
  due_date: string;
  escalation_stage: string;
}

export interface TransactionItem {
  id: string;
  booking_date: string;
  amount: number;
  display_name: string;
  creditor_name: string | null;
  pw_category: string;
  pw_sub_category: string | null;
  category_source: string | null;
  category_confidence: number | null;
  creditor_iban: string | null;
}

export interface SubscriptionItem {
  id: string;
  creditor_name: string;
  merchant_clean_name: string | null;
  pw_category: string | null;
  frequency: string;
  avg_amount: number;
  annual_cost: number;
  occurrences: number;
  confidence: number | null;
  last_paid: string | null;
  next_expected: string | null;
}

export interface AnalyticsBundle {
  monthly_categories: MonthlyCategoryItem[];
  weekly_cashflow: WeeklyCashflowItem[];
  monthly_totals: MonthlyTotalItem[];
  debt_summary: DebtItem[];
  has_bank_connection: boolean;
  uncategorized_count: number;
  transactions: TransactionItem[];
  subscriptions: SubscriptionItem[];
}
