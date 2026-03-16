/** Bill status options */
export type BillStatus = 'outstanding' | 'action' | 'settled' | 'failed' | 'review';

/** Bill source */
export type BillSource = 'manual' | 'gmail_scan' | 'camera_scan';

/** Escalation stages (Dutch debt collection) */
export type EscalationStage = 'factuur' | 'herinnering' | 'aanmaning' | 'incasso' | 'deurwaarder';

/** Bill category defaults */
export const BILL_CATEGORIES = [
  'energie',
  'water',
  'internet',
  'telefoon',
  'verzekering',
  'huur',
  'belasting',
  'zorg',
  'abonnement',
  'overig',
] as const;

/** Bill row from database */
export interface Bill {
  id: string;
  user_id: string;
  vendor: string;
  amount: number; // CENTS
  currency: string;
  iban: string | null;
  reference: string | null;
  due_date: string; // YYYY-MM-DD
  received_date: string; // YYYY-MM-DD
  paid_at: string | null;
  paid_date: string | null;
  category: string;
  status: BillStatus;
  source: BillSource;
  hash: string;
  requires_review: boolean;
  is_favorite: boolean;
  notes: string | null;
  payment_url: string | null;
  escalation_stage: EscalationStage;
  estimated_extra_costs: number;
  created_at: string;
  updated_at: string;
}

/**
 * Format cents to currency display string.
 * 12345 → "€123,45"
 */
export function formatCents(cents: number, currency: string = 'EUR'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse a user-entered amount string to cents.
 * "123,45" → 12345
 * "123.45" → 12345
 * "123" → 12300
 */
export function parseToCents(input: string): number | null {
  const cleaned = input.replace(/[€$£\s]/g, '').trim();
  if (!cleaned) return null;

  const normalized = cleaned.replace(',', '.');
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed < 0) return null;

  return Math.round(parsed * 100);
}
