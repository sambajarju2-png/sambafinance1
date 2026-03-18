import { createHash } from 'crypto';

export function generateBillId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `bill_${timestamp}_${random}`;
}

export function computeBillHash(vendor: string, amountCents: number, reference: string, dueDate: string): string {
  const input = [vendor.toLowerCase().trim(), amountCents.toString(), reference?.toLowerCase().trim() || dueDate].join('|');
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

const ESCALATION_ORDER = ['factuur', 'herinnering', 'aanmaning', 'incasso', 'deurwaarder'] as const;

/**
 * Get the next escalation stage.
 * If amount went up, assume it escalated one level.
 */
function getNextStage(currentStage: string): string {
  const idx = ESCALATION_ORDER.indexOf(currentStage as typeof ESCALATION_ORDER[number]);
  if (idx === -1 || idx >= ESCALATION_ORDER.length - 1) return currentStage;
  return ESCALATION_ORDER[idx + 1];
}

/**
 * Smart dedup: checks reference+vendor match.
 * If amount INCREASED → auto-escalate to next stage.
 * If amount same → skip (duplicate).
 * If no match → insert new.
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
  hash: string,
  newStage?: string | null
): Promise<{ action: 'insert' | 'updated' | 'duplicate'; existingId?: string }> {
  // 1. Check reference + vendor (case-insensitive)
  if (reference) {
    const { data: existingByRef } = await supabase
      .from('bills')
      .select('id, amount, escalation_stage, hash')
      .eq('user_id', userId)
      .ilike('vendor', vendor.trim())
      .eq('reference', reference.trim())
      .neq('status', 'settled')
      .maybeSingle();

    if (existingByRef) {
      if (existingByRef.amount !== amountCents) {
        // Amount changed — update bill
        const amountIncreased = amountCents > existingByRef.amount;
        const currentStage = existingByRef.escalation_stage || 'factuur';

        // Auto-escalate if amount went UP (more costs = next stage)
        let updatedStage = newStage || currentStage;
        if (amountIncreased && !newStage) {
          updatedStage = getNextStage(currentStage);
        }

        await supabase.from('bills').update({
          amount: amountCents,
          hash,
          escalation_stage: updatedStage,
          updated_at: new Date().toISOString(),
        }).eq('id', existingByRef.id);

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
