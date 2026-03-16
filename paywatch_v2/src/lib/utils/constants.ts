/**
 * PayWatch shared constants
 * Source of truth for escalation stages, colors, and categories.
 */

/* ——— Escalation stages ——— */
export const ESCALATION_STAGES = [
  'factuur',
  'herinnering',
  'aanmaning',
  'incasso',
  'deurwaarder',
] as const;

export type EscalationStage = (typeof ESCALATION_STAGES)[number];

export const STAGE_COLORS: Record<EscalationStage, string> = {
  factuur: '#2563EB',    // blue
  herinnering: '#D97706', // amber
  aanmaning: '#EA580C',   // orange
  incasso: '#DC2626',     // red
  deurwaarder: '#991B1B', // dark-red
};

export const STAGE_BG_COLORS: Record<EscalationStage, string> = {
  factuur: '#EFF6FF',
  herinnering: '#FEF3C7',
  aanmaning: '#FFF7ED',
  incasso: '#FEF2F2',
  deurwaarder: '#FEF2F2',
};

/* ——— Bill statuses ——— */
export const BILL_STATUSES = [
  'outstanding',
  'action',
  'settled',
  'failed',
  'review',
] as const;

export type BillStatus = (typeof BILL_STATUSES)[number];

/* ——— Bill sources ——— */
export const BILL_SOURCES = ['manual', 'gmail_scan', 'camera_scan'] as const;
export type BillSource = (typeof BILL_SOURCES)[number];

/* ——— Default categories ——— */
export const DEFAULT_CATEGORIES = [
  'energie',
  'water',
  'internet',
  'telefoon',
  'verzekering',
  'huur',
  'hypotheek',
  'belasting',
  'zorg',
  'abonnement',
  'overig',
] as const;

/* ——— Currency ——— */
export const DEFAULT_CURRENCY = 'EUR';

/**
 * Format cents to display amount (e.g., 12345 → "123,45")
 * Always use integers (cents) in the database.
 */
export function formatAmount(cents: number, locale: string = 'nl-NL'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Parse display amount to cents (e.g., "123,45" → 12345)
 */
export function parseToCents(amount: string): number {
  const cleaned = amount.replace(/[^0-9.,\-]/g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned) * 100);
}
