/**
 * PayWatch Widget Bridge
 *
 * Syncs data from the web app to the native iOS Widget Extension
 * via a Capacitor plugin that writes to App Groups UserDefaults.
 *
 * Usage:
 *   import { updateWidget, clearWidget } from '@/lib/widget-bridge';
 *
 *   // After fetching bills/analytics from Supabase:
 *   await updateWidget(buildWidgetPayload(bills, analytics, subscriptions));
 *
 *   // On logout:
 *   await clearWidget();
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

// MARK: - Plugin Interface

interface WidgetBridgePlugin {
  updateWidgetData(options: { data: string }): Promise<{ success: boolean }>;
  clearWidgetData(): Promise<{ success: boolean }>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

// MARK: - Widget Payload Types (matches WidgetData.swift)

export interface WidgetPayload {
  updated_at: string;
  outstanding_amount: number;    // cents
  overdue_count: number;
  upcoming_count: number;
  paid_amount: number;           // cents
  bank_income: number;           // cents
  bank_expenses: number;         // cents
  net: number;                   // cents
  disposable: number;            // cents
  next_bill: WidgetBill | null;
  upcoming_bills: WidgetBillSummary[];
  subscription_total_monthly: number; // cents
  debt_free_months: number | null;
}

export interface WidgetBill {
  vendor: string;
  amount: number;                // cents
  due_date: string;              // "2026-05-01"
  days_until: number;
  stage: string;                 // "factuur" | "herinnering" | "aanmaning" | "incasso" | "deurwaarder"
}

export interface WidgetBillSummary {
  vendor: string;
  amount: number;                // cents
  due_date: string;
  stage: string;
}

// MARK: - Public API

/**
 * Write widget data to the native shared container.
 * No-op on web (non-native platforms).
 * Call this after Supabase data loads on the dashboard.
 */
export async function updateWidget(payload: WidgetPayload): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await WidgetBridge.updateWidgetData({
      data: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[WidgetBridge] Update failed:', e);
  }
}

/**
 * Clear all widget data from the native shared container.
 * Call this on user logout to remove sensitive financial data.
 */
export async function clearWidget(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await WidgetBridge.clearWidgetData();
  } catch (e) {
    console.warn('[WidgetBridge] Clear failed:', e);
  }
}

// MARK: - Payload Builder

/**
 * Quick sync — call from dashboard with just bills.
 * Matches the actual Bill type and status logic from @/lib/bills.
 *
 * Usage in overzicht/page.tsx:
 *   import { syncWidgetFromBills } from '@/lib/widget-bridge';
 *   // after setBills(fresh):
 *   syncWidgetFromBills(fresh);
 */
export function syncWidgetFromBills(
  bills: Array<{
    vendor: string;
    amount: number;
    due_date: string;
    status: string;
    escalation_stage: string;
  }>
): void {
  const payload = buildWidgetPayload(bills);
  updateWidget(payload);
}

/**
 * Build the widget payload from bills data.
 * Status logic matches the dashboard:
 *   - outstanding = status !== 'settled'
 *   - overdue = outstanding + due_date < today
 *   - upcoming = outstanding + due_date >= today
 */
export function buildWidgetPayload(
  bills: Array<{
    vendor: string;
    amount: number;          // cents
    due_date: string;
    status: string;
    escalation_stage: string;
  }>
): WidgetPayload {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Split bills using same logic as overzicht/page.tsx
  const outstanding = bills.filter((b) => b.status !== 'settled');
  const overdue = outstanding.filter((b) => b.due_date < today);
  const upcoming = outstanding.filter((b) => b.due_date >= today);
  const settled = bills.filter((b) => b.status === 'settled');

  // Sort upcoming by due date (soonest first)
  const sortedUpcoming = [...upcoming].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  // Calculate days until due
  const daysUntil = (dateStr: string): number => {
    const due = new Date(dateStr + 'T00:00:00');
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.ceil(
      (due.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, diff);
  };

  // Next bill (soonest upcoming)
  const nextBillRaw = sortedUpcoming[0] || null;
  const nextBill: WidgetBill | null = nextBillRaw
    ? {
        vendor: nextBillRaw.vendor,
        amount: nextBillRaw.amount,
        due_date: nextBillRaw.due_date,
        days_until: daysUntil(nextBillRaw.due_date),
        stage: nextBillRaw.escalation_stage || 'factuur',
      }
    : null;

  // Upcoming bills (top 5 for large widget later)
  const upcomingBills: WidgetBillSummary[] = sortedUpcoming
    .slice(0, 5)
    .map((b) => ({
      vendor: b.vendor,
      amount: b.amount,
      due_date: b.due_date,
      stage: b.escalation_stage || 'factuur',
    }));

  // Totals
  const outstandingAmount = outstanding.reduce((sum, b) => sum + b.amount, 0);
  const settledAmount = settled.reduce((sum, b) => sum + b.amount, 0);

  return {
    updated_at: now.toISOString(),
    outstanding_amount: outstandingAmount,
    overdue_count: overdue.length,
    upcoming_count: upcoming.length,
    paid_amount: settledAmount,
    // Analytics fields — 0 for now, enriched when bank sync data is available
    bank_income: 0,
    bank_expenses: 0,
    net: 0,
    disposable: 0,
    next_bill: nextBill,
    upcoming_bills: upcomingBills,
    subscription_total_monthly: 0,
    debt_free_months: null,
  };
}
