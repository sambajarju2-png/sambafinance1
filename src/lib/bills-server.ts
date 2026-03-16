import { createHash } from 'crypto';

/**
 * Generate a dedup hash for a bill.
 * Based on vendor + amount + reference (or due_date if no reference).
 * This prevents duplicate bill insertion.
 *
 * SERVER-ONLY — do not import in client components.
 */
export function computeBillHash(
  vendor: string,
  amountCents: number,
  reference: string | null,
  dueDate: string
): string {
  const input = [
    vendor.toLowerCase().trim(),
    amountCents.toString(),
    reference?.toLowerCase().trim() || dueDate,
  ].join('|');

  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

/**
 * Generate a unique bill ID.
 * Format: bill_<timestamp>_<random>
 *
 * SERVER-ONLY — do not import in client components.
 */
export function generateBillId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `bill_${timestamp}_${random}`;
}
