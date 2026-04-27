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
 * Build the widget payload from your existing Supabase data.
 *
 * Example integration in your dashboard page:
 *
 *   const bills = await fetchBills(userId);
 *   const analytics = await fetchAnalytics(userId);
 *   const subscriptions = await fetchSubscriptions(userId);
 *   const finances = await fetchUserFinances(userId);
 *
 *   const payload = buildWidgetPayload(bills, analytics, subscriptions, finances);
 *   await updateWidget(payload);
 */
export function buildWidgetPayload(
  bills: Array<{
    vendor: string;
    amount: number;          // already in cents
    due_date: string;
    status: string;
    escalation_stage: string;
  }>,
  analytics: {
    income_cents: number;
    expenses_cents: number;
    net_cents: number;
  } | null,
  subscriptions: Array<{
    merchant_clean_name: string;
    avg_amount: number;      // cents
  }>,
  finances: {
    netto_inkomen: number;   // cents
  } | null
): WidgetPayload {
  const now = new Date();

  // Split bills by status
  const outstanding = bills.filter(
    (b) => b.status === 'outstanding' || b.status === 'overdue'
  );
  const overdue = bills.filter((b) => b.status === 'overdue');
  const upcoming = bills.filter((b) => b.status === 'outstanding');
  const paid = bills.filter((b) => b.status === 'paid');

  // Sort upcoming by due date (soonest first)
  const sortedUpcoming = [...upcoming].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  // Calculate days until due
  const daysUntil = (dateStr: string): number => {
    const due = new Date(dateStr);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diff = Math.ceil(
      (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, diff);
  };

  // Next bill
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

  // Upcoming bills (top 5)
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
  const paidAmount = paid.reduce((sum, b) => sum + b.amount, 0);
  const subscriptionTotal = subscriptions.reduce(
    (sum, s) => sum + s.avg_amount,
    0
  );

  // Financial snapshot
  const income = analytics?.income_cents ?? finances?.netto_inkomen ?? 0;
  const expenses = analytics?.expenses_cents ?? 0;
  const net = analytics?.net_cents ?? income - expenses;

  // Rough debt-free estimate (months)
  const monthlyDisposable = income - expenses;
  const debtFreeMonths =
    monthlyDisposable > 0 && outstandingAmount > 0
      ? Math.ceil(outstandingAmount / monthlyDisposable)
      : null;

  return {
    updated_at: now.toISOString(),
    outstanding_amount: outstandingAmount,
    overdue_count: overdue.length,
    upcoming_count: upcoming.length,
    paid_amount: paidAmount,
    bank_income: income,
    bank_expenses: expenses,
    net: net,
    disposable: Math.max(0, income - expenses - subscriptionTotal),
    next_bill: nextBill,
    upcoming_bills: upcomingBills,
    subscription_total_monthly: subscriptionTotal,
    debt_free_months: debtFreeMonths,
  };
}
