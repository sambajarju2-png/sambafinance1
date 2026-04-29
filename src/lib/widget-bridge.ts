/**
 * PayWatch Widget Bridge
 *
 * Syncs data from the web app to the native iOS Widget Extension
 * via WKScriptMessageHandler (direct WebKit bridge, no Capacitor plugin).
 *
 * The native side (AppDelegate.swift) injects window.PayWatchNativeBridge
 * after Capacitor's webview loads. This bridge also works via the raw
 * window.webkit.messageHandlers API as a fallback.
 */

import { Capacitor } from '@capacitor/core';

// MARK: - Types

declare global {
  interface Window {
    PayWatchNativeBridge?: {
      updateWidgetData: (jsonString: string) => void;
      clearWidgetData: () => void;
      storeAuthToken: (token: string) => void;
    };
    webkit?: {
      messageHandlers?: {
        widgetData?: { postMessage: (body: string) => void };
        widgetClear?: { postMessage: (body: string) => void };
        widgetAuth?: { postMessage: (body: string) => void };
      };
    };
  }
}

export interface WidgetPayload {
  updated_at: string;
  outstanding_amount: number;
  overdue_count: number;
  upcoming_count: number;
  paid_amount: number;
  bank_income: number;
  bank_expenses: number;
  net: number;
  disposable: number;
  next_bill: WidgetBill | null;
  upcoming_bills: WidgetBillSummary[];
  subscription_total_monthly: number;
  debt_free_months: number | null;
}

export interface WidgetBill {
  id: string;
  vendor: string;
  amount: number;
  due_date: string;
  days_until: number;
  stage: string;
}

export interface WidgetBillSummary {
  id: string;
  vendor: string;
  amount: number;
  due_date: string;
  stage: string;
}

// MARK: - Native bridge helpers

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function sendToNative(handler: string, body: string): void {
  // Try injected bridge first
  if (handler === 'widgetData' && window.PayWatchNativeBridge?.updateWidgetData) {
    window.PayWatchNativeBridge.updateWidgetData(body);
    return;
  }
  if (handler === 'widgetClear' && window.PayWatchNativeBridge?.clearWidgetData) {
    window.PayWatchNativeBridge.clearWidgetData();
    return;
  }
  if (handler === 'widgetAuth' && window.PayWatchNativeBridge?.storeAuthToken) {
    window.PayWatchNativeBridge.storeAuthToken(body);
    return;
  }
  // Fallback: direct webkit message handler
  const mh = window.webkit?.messageHandlers;
  if (handler === 'widgetData' && mh?.widgetData) {
    mh.widgetData.postMessage(body);
  } else if (handler === 'widgetClear' && mh?.widgetClear) {
    mh.widgetClear.postMessage(body);
  } else if (handler === 'widgetAuth' && mh?.widgetAuth) {
    mh.widgetAuth.postMessage(body);
  } else {
    console.warn(`[WidgetBridge] Handler "${handler}" not available yet`);
  }
}

// MARK: - Public API

export async function updateWidget(payload: WidgetPayload): Promise<void> {
  if (!isNative()) return;
  try {
    sendToNative('widgetData', JSON.stringify(payload));
  } catch (e) {
    console.warn('[WidgetBridge] Update failed:', e);
  }
}

export async function clearWidget(): Promise<void> {
  if (!isNative()) return;
  try {
    sendToNative('widgetClear', 'clear');
  } catch (e) {
    console.warn('[WidgetBridge] Clear failed:', e);
  }
}

export async function storeWidgetAuth(accessToken: string): Promise<void> {
  if (!isNative()) return;
  try {
    sendToNative('widgetAuth', accessToken);
  } catch (e) {
    console.warn('[WidgetBridge] Auth store failed:', e);
  }
}

export async function checkWidgetSync(): Promise<string[]> {
  // Sync-back not available via message handlers (one-way).
  // The background refresh handles keeping data fresh.
  return [];
}

// MARK: - Payload Builder

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
  const payload = buildWidgetPayload(bills);

  // Enrich with financial data
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
    // Financial data unavailable
  }

  if (payload.bank_income > 0 && payload.outstanding_amount > 0) {
    const monthly = payload.bank_income - payload.bank_expenses;
    if (monthly > 0) {
      payload.debt_free_months = Math.ceil(payload.outstanding_amount / monthly);
    }
  }

  updateWidget(payload);
}

export function buildWidgetPayload(
  bills: Array<{
    id: string;
    vendor: string;
    amount: number;
    due_date: string;
    status: string;
    escalation_stage: string;
  }>
): WidgetPayload {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const outstanding = bills.filter((b) => b.status !== 'settled');
  const overdue = outstanding.filter((b) => b.due_date < today);
  const upcoming = outstanding.filter((b) => b.due_date >= today);
  const settled = bills.filter((b) => b.status === 'settled');

  const sortedUpcoming = [...upcoming].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  const daysUntil = (dateStr: string): number => {
    const due = new Date(dateStr + 'T00:00:00');
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.ceil((due.getTime() - todayDate.getTime()) / 86400000));
  };

  const nextBillRaw = sortedUpcoming[0] || null;

  return {
    updated_at: now.toISOString(),
    outstanding_amount: outstanding.reduce((s, b) => s + b.amount, 0),
    overdue_count: overdue.length,
    upcoming_count: upcoming.length,
    paid_amount: settled.reduce((s, b) => s + b.amount, 0),
    bank_income: 0,
    bank_expenses: 0,
    net: 0,
    disposable: 0,
    next_bill: nextBillRaw
      ? {
          id: nextBillRaw.id,
          vendor: nextBillRaw.vendor,
          amount: nextBillRaw.amount,
          due_date: nextBillRaw.due_date,
          days_until: daysUntil(nextBillRaw.due_date),
          stage: nextBillRaw.escalation_stage || 'factuur',
        }
      : null,
    upcoming_bills: sortedUpcoming.slice(0, 5).map((b) => ({
      id: b.id,
      vendor: b.vendor,
      amount: b.amount,
      due_date: b.due_date,
      stage: b.escalation_stage || 'factuur',
    })),
    subscription_total_monthly: 0,
    debt_free_months: null,
  };
}
