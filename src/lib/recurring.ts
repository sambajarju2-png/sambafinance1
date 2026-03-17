import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RecurringPattern {
  vendor: string;
  count: number;
  typical_amount: number;
  frequency_days: number;
  next_expected: string;
}

/**
 * Detect recurring bill patterns from a user's bill history.
 * Groups by vendor, calculates average interval and amount.
 * Saves patterns to recurring_patterns table.
 * SERVER-ONLY.
 */
export async function detectRecurringPatterns(userId: string): Promise<RecurringPattern[]> {
  const supabase = await createServerSupabaseClient();

  // Get all bills ordered by vendor + date
  const { data: bills } = await supabase
    .from('bills')
    .select('vendor, amount, due_date, received_date')
    .eq('user_id', userId)
    .order('vendor')
    .order('due_date', { ascending: true });

  if (!bills || bills.length < 2) return [];

  // Group by vendor (case-insensitive)
  const vendorGroups: Record<string, Array<{ amount: number; due_date: string }>> = {};
  for (const bill of bills) {
    const key = bill.vendor.toLowerCase().trim();
    if (!vendorGroups[key]) vendorGroups[key] = [];
    vendorGroups[key].push({ amount: bill.amount, due_date: bill.due_date });
  }

  const patterns: RecurringPattern[] = [];

  for (const [vendorKey, vendorBills] of Object.entries(vendorGroups)) {
    // Need at least 2 bills from same vendor to detect a pattern
    if (vendorBills.length < 2) continue;

    // Sort by due_date
    vendorBills.sort((a, b) => a.due_date.localeCompare(b.due_date));

    // Calculate intervals between consecutive bills
    const intervals: number[] = [];
    for (let i = 1; i < vendorBills.length; i++) {
      const prev = new Date(vendorBills[i - 1].due_date + 'T00:00:00');
      const curr = new Date(vendorBills[i].due_date + 'T00:00:00');
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diffDays > 0 && diffDays < 400) {
        intervals.push(diffDays);
      }
    }

    if (intervals.length === 0) continue;

    // Average interval
    const avgInterval = Math.round(intervals.reduce((s, d) => s + d, 0) / intervals.length);

    // Average amount
    const avgAmount = Math.round(vendorBills.reduce((s, b) => s + b.amount, 0) / vendorBills.length);

    // Predict next due date
    const lastDue = vendorBills[vendorBills.length - 1].due_date;
    const nextDate = new Date(lastDue + 'T00:00:00');
    nextDate.setDate(nextDate.getDate() + avgInterval);
    const nextExpected = nextDate.toISOString().split('T')[0];

    // Use original vendor name from first bill
    const originalVendor = bills.find(
      (b) => b.vendor.toLowerCase().trim() === vendorKey
    )?.vendor || vendorKey;

    patterns.push({
      vendor: originalVendor,
      count: vendorBills.length,
      typical_amount: avgAmount,
      frequency_days: avgInterval,
      next_expected: nextExpected,
    });
  }

  // Save to DB (upsert by vendor)
  for (const pattern of patterns) {
    await supabase.from('recurring_patterns').upsert(
      {
        user_id: userId,
        vendor: pattern.vendor,
        typical_amount: pattern.typical_amount,
        frequency_days: pattern.frequency_days,
        next_expected: pattern.next_expected,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,vendor' }
    );
  }

  // Also flag bills as recurring
  for (const pattern of patterns) {
    await supabase
      .from('bills')
      .update({ is_recurring: true })
      .eq('user_id', userId)
      .ilike('vendor', pattern.vendor);
  }

  return patterns;
}
