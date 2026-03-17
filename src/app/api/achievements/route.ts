import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ACHIEVEMENTS, checkAndUnlockAchievements } from '@/lib/achievements';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    // Check for any new unlocks
    await checkAndUnlockAchievements(userId);

    const supabase = await createServerSupabaseClient();
    const { data: unlocked } = await supabase
      .from('user_achievements')
      .select('achievement, unlocked_at')
      .eq('user_id', userId);

    const unlockedKeys = new Set((unlocked || []).map((a: { achievement: string }) => a.achievement));

    const all = ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: unlockedKeys.has(a.key),
      unlocked_at: (unlocked || []).find((u: { achievement: string }) => u.achievement === a.key)?.unlocked_at || null,
    }));

    return NextResponse.json({ achievements: all }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Achievements error:', err);
    return NextResponse.json({ achievements: [] }, { headers: NO_CACHE });
  }
}
