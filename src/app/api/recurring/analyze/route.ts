import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    const { data: bills, error } = await supabase
      .from('bills')
      .select('vendor, amount, due_date, category')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    if (!bills || bills.length < 2) {
      return NextResponse.json({ patterns: [], count: 0 }, { headers: NO_CACHE });
    }

    // Group by normalized vendor
    const groups = new Map<string, typeof bills>();
    for (const bill of bills) {
      const key = bill.vendor.toLowerCase().trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(bill);
    }

    const patterns = [];

    for (const [, vendorBills] of groups) {
      if (vendorBills.length < 2) continue;

      const intervals: number[] = [];
      for (let i = 1; i < vendorBills.length; i++) {
        const diff = Math.round(
          (new Date(vendorBills[i].due_date).getTime() - new Date(vendorBills[i - 1].due_date).getTime()) / 86400000
        );
        if (diff > 0 && diff < 400) intervals.push(diff);
      }
      if (intervals.length === 0) continue;

      const avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
      const snapped = snapToFrequency(avgInterval);

      const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
      const consistency = 1 - Math.min(Math.sqrt(variance) / avgInterval, 1);
      const confidence = Math.round((consistency * 0.7 + Math.min(vendorBills.length / 6, 1) * 0.3) * 100) / 100;
      if (confidence < 0.3) continue;

      const amounts = vendorBills.map(b => b.amount);
      const lastBill = vendorBills[vendorBills.length - 1];
      const nextDate = new Date(new Date(lastBill.due_date).getTime() + snapped * 86400000);

      const pattern = {
        vendor: lastBill.vendor,
        frequency_days: snapped,
        typical_amount: lastBill.amount,
        avg_amount: Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length),
        next_expected: nextDate.toISOString().split('T')[0],
        category: lastBill.category,
        confidence,
        occurrences: vendorBills.length,
        last_seen: lastBill.due_date,
      };

      patterns.push(pattern);

      await supabase.from('recurring_patterns').upsert({
        user_id: userId,
        ...pattern,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,vendor' });

      await supabase.from('bills')
        .update({ is_recurring: true, recurrence_group: lastBill.vendor.toLowerCase().trim() })
        .eq('user_id', userId)
        .ilike('vendor', lastBill.vendor);
    }

    return NextResponse.json({ patterns, count: patterns.length }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Recurring analysis error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500, headers: NO_CACHE });
  }
}

function snapToFrequency(days: number): number {
  const targets = [7, 14, 30, 60, 91, 182, 365];
  let closest = targets[0];
  let minDiff = Math.abs(days - targets[0]);
  for (const t of targets) {
    const diff = Math.abs(days - t);
    if (diff < minDiff) { minDiff = diff; closest = t; }
  }
  return minDiff / closest <= 0.2 ? closest : days;
}
