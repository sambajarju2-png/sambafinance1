import { createHash } from 'crypto';

/**
 * Generate a unique bill ID.
 */
export function generateBillId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `bill_${timestamp}_${random}`;
}

/**
 * Compute dedup hash for a bill.
 * NOT async — do not await.
 */
export function computeBillHash(
  vendor: string,
  amountCents: number,
  reference: string,
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
 * Smart dedup: check if a bill with same vendor + reference already exists.
 * If found with different amount → update it. If exact match → skip.
 * Returns: { action: 'insert' | 'updated' | 'duplicate', existingId?: string }
 *
 * Used by: manual add, photo scan, Gmail scan.
 * SERVER-ONLY.
 */
export async function smartDedup(
  supabase: { from: (table: string) => any },
  userId: string,
  vendor: string,
  amountCents: number,
  reference: string | null,
  hash: string
): Promise<{ action: 'insert' | 'updated' | 'duplicate'; existingId?: string }> {
  // 1. Check by reference + vendor (case-insensitive)
  if (reference) {
    const { data: existingByRef } = await supabase
      .from('bills')
      .select('id, amount, hash')
      .eq('user_id', userId)
      .ilike('vendor', vendor.trim())
      .eq('reference', reference.trim())
      .neq('status', 'settled')
      .maybeSingle();

    if (existingByRef) {
      if (existingByRef.amount !== amountCents) {
        // Same bill, amount changed → update
        await supabase
          .from('bills')
          .update({
            amount: amountCents,
            hash,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingByRef.id);

        return { action: 'updated', existingId: existingByRef.id };
      }
      return { action: 'duplicate', existingId: existingByRef.id };
    }
  }

  // 2. Check by exact hash
  const { data: existingByHash } = await supabase
    .from('bills')
    .select('id')
    .eq('user_id', userId)
    .eq('hash', hash)
    .maybeSingle();

  if (existingByHash) {
    return { action: 'duplicate', existingId: existingByHash.id };
  }

  return { action: 'insert' };
}
