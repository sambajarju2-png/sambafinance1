import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Recalculate streak from settled bills. Grace period: 3 days.
 * SERVER-ONLY.
 */
export async function recalculateStreak(userId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();

  const { data: settledBills } = await supabase
    .from('bills')
    .select('due_date, paid_date')
    .eq('user_id', userId)
    .eq('status', 'settled')
    .not('paid_date', 'is', null)
    .not('due_date', 'is', null)
    .order('paid_date', { ascending: false })
    .limit(100);

  if (!settledBills || settledBills.length === 0) {
    await updateStreak(supabase, userId, 0);
    return 0;
  }

  let streak = 0;
  for (const bill of settledBills) {
    if (!bill.paid_date || !bill.due_date) continue;
    const due = new Date(bill.due_date + 'T00:00:00');
    const paid = new Date(bill.paid_date + 'T00:00:00');
    const grace = new Date(due);
    grace.setDate(grace.getDate() + 3);

    if (paid <= grace) {
      streak++;
    } else {
      break;
    }
  }

  await updateStreak(supabase, userId, streak);
  return streak;
}

async function updateStreak(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  streak: number
) {
  const { data: settings } = await supabase
    .from('user_settings')
    .select('streak_best')
    .eq('user_id', userId)
    .single();

  await supabase.from('user_settings').update({
    streak_current: streak,
    streak_best: Math.max(settings?.streak_best || 0, streak),
    streak_last_check: new Date().toISOString().split('T')[0],
  }).eq('user_id', userId);
}
