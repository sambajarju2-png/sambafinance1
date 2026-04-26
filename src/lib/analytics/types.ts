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

export interface AnalyticsBundle {
  monthly_categories: MonthlyCategoryItem[];
  weekly_cashflow: WeeklyCashflowItem[];
  monthly_totals: MonthlyTotalItem[];
  debt_summary: DebtItem[];
  has_bank_connection: boolean;
  uncategorized_count: number;
}
