import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { calculateWIKCosts } from '@/lib/wik';
import { ACHIEVEMENTS } from '@/lib/achievements';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    const [
      { data: achievements },
      { data: bills },
      { data: settings },
      { data: profile },
    ] = await Promise.all([
      supabase.from('user_achievements').select('achievement, unlocked_at').eq('user_id', userId),
      supabase.from('bills').select('status, amount, paid_date, due_date').eq('user_id', userId),
      supabase.from('user_settings').select('streak_current, streak_best').eq('user_id', userId).single(),
      supabase.from('community_profiles').select('display_name').eq('user_id', userId).single(),
    ]);

    const unlockedCount = (achievements || []).length;
    const totalAchievements = ACHIEVEMENTS.length;

    const allBills = bills || [];
    const settled = allBills.filter(b => b.status === 'settled');
    const totalPaid = settled.length;

    // Calculate saved costs
    let savedCents = 0;
    for (const bill of settled) {
      if (bill.paid_date && bill.due_date && bill.paid_date <= bill.due_date) {
        savedCents += calculateWIKCosts(bill.amount);
      }
    }

    // Find earliest unlock date
    const dates = (achievements || []).map(a => new Date(a.unlocked_at).getTime()).filter(Boolean);
    const memberSince = dates.length > 0
      ? new Date(Math.min(...dates)).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    return NextResponse.json({
      display_name: profile?.display_name || null,
      unlocked_count: unlockedCount,
      total_achievements: totalAchievements,
      total_paid: totalPaid,
      saved_cents: savedCents,
      streak_current: settings?.streak_current || 0,
      streak_best: settings?.streak_best || 0,
      member_since: memberSince,
      achievements: (achievements || []).map(a => {
        const def = ACHIEVEMENTS.find(d => d.key === a.achievement);
        return { key: a.achievement, icon: def?.icon || '?', unlocked_at: a.unlocked_at };
      }),
    }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Share data error:', err);
    return NextResponse.json({ error: 'Failed to load share data' }, { status: 500, headers: NO_CACHE });
  }
}
