import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ count: 0, items: [] }, { headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Overdue bills
    const { data: overdueBills } = await supabase
      .from('bills')
      .select('id, vendor, amount, due_date, escalation_stage')
      .eq('user_id', userId)
      .neq('status', 'settled')
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(10);

    // Upcoming bills (next 3 days)
    const threeDays = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
    const { data: upcomingBills } = await supabase
      .from('bills')
      .select('id, vendor, amount, due_date')
      .eq('user_id', userId)
      .neq('status', 'settled')
      .gte('due_date', today)
      .lte('due_date', threeDays)
      .order('due_date', { ascending: true })
      .limit(5);

    // Recent achievements
    const { data: recentAchievements } = await supabase
      .from('user_achievements')
      .select('achievement, unlocked_at')
      .eq('user_id', userId)
      .gte('unlocked_at', weekAgo)
      .order('unlocked_at', { ascending: false })
      .limit(5);

    const items: Array<{ type: string; data: unknown }> = [];

    for (const bill of (overdueBills || [])) {
      items.push({ type: 'overdue', data: bill });
    }
    for (const bill of (upcomingBills || [])) {
      items.push({ type: 'upcoming', data: bill });
    }
    for (const ach of (recentAchievements || [])) {
      items.push({ type: 'achievement', data: ach });
    }

    const count = (overdueBills?.length || 0) + (recentAchievements?.length || 0);

    return NextResponse.json({ count, items, overdue: overdueBills?.length || 0, achievements: recentAchievements?.length || 0 }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ count: 0, items: [] }, { headers: NO_CACHE });
  }
}
