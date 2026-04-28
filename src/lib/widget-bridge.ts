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
  storeAuthToken(options: { token: string; apiBase?: string }): Promise<{ success: boolean }>;
  clearWidgetData(): Promise<{ success: boolean }>;
  getWidgetState(): Promise<{ needsSync: boolean; widgetData: string }>;
  clearSyncFlag(): Promise<{ success: boolean }>;
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
  id: string;                    // Supabase bill UUID
  vendor: string;
  amount: number;                // cents
  due_date: string;              // "2026-05-01"
  days_until: number;
  stage: string;
}

export interface WidgetBillSummary {
  id: string;                    // Supabase bill UUID
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

/**
 * Store Supabase auth token in App Groups for background refresh.
 * The BGAppRefreshTask reads this token to fetch fresh data
 * from /api/widget/data when the app is closed.
 *
 * Call this after successful login or token refresh.
 */
export async function storeWidgetAuth(accessToken: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await WidgetBridge.storeAuthToken({
      token: accessToken,
      apiBase: typeof window !== 'undefined' ? window.location.origin : 'https://app.paywatch.app',
    });
  } catch (e) {
    console.warn('[WidgetBridge] Auth store failed:', e);
  }
}

/**
 * Check if the widget marked any bills as paid.
 * Call this when app returns to foreground.
 * Returns bill IDs that need to be updated in Supabase.
 */
export async function checkWidgetSync(): Promise<string[]> {
  if (!Capacitor.isNativePlatform()) return [];

  try {
    const { needsSync } = await WidgetBridge.getWidgetState();
    if (!needsSync) return [];

    // Read pending paid bill IDs from App Groups
    // (stored by MarkBillAsPaidIntent in Swift)
    // For now, return flag so dashboard knows to re-fetch
    await WidgetBridge.clearSyncFlag();
    return ['_needs_refetch'];
  } catch (e) {
    console.warn('[WidgetBridge] Sync check failed:', e);
    return [];
  }
}

// MARK: - Payload Builder

/**
 * Quick sync — call from dashboard with bills + optional financial data.
 * Fetches /api/finances/overview in the background to enrich the payload.
 */
export async function syncWidgetFromBills(
  bills: Array<{
    id: string;
    vendor: string;
    amount: number;
    due_date: string;
    status: string;
    escalation_stage: string;
  }>
): Promise<void> {
  // Build base payload from bills immediately
  const payload = buildWidgetPayload(bills);

  // Try to enrich with financial data (non-blocking)
  try {
    const res = await fetch('/api/finances/overview');
    if (res.ok) {
      const fin = await res.json();
      if (fin.has_finances) {
        payload.bank_income = fin.totaal_inkomen || 0;
        payload.bank_expenses = (fin.totaal_vaste_lasten || 0) + (fin.totaal_betaald_deze_maand || 0);
        payload.disposable = Math.max(0, fin.vrij_besteedbaar || 0);
        payload.net = (fin.totaal_inkomen || 0) - payload.bank_expenses;
      }
    }
  } catch {
    // Financial data unavailable — widget still works with bills-only data
  }

  // Compute debt-free estimate with real financial data
  if (payload.bank_income > 0 && payload.outstanding_amount > 0) {
    const monthly = payload.bank_income - payload.bank_expenses;
    if (monthly > 0) {
      payload.debt_free_months = Math.ceil(payload.outstanding_amount / monthly);
    }
  }

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
    id: string;
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
        id: nextBillRaw.id,
        vendor: nextBillRaw.vendor,
        amount: nextBillRaw.amount,
        due_date: nextBillRaw.due_date,
        days_until: daysUntil(nextBillRaw.due_date),
        stage: nextBillRaw.escalation_stage || 'factuur',
      }
    : null;

  // Upcoming bills (top 5 for large widget)
  const upcomingBills: WidgetBillSummary[] = sortedUpcoming
    .slice(0, 5)
    .map((b) => ({
      id: b.id,
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
