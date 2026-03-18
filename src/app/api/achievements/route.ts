import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ACHIEVEMENTS, checkAndUnlockAchievements } from '@/lib/achievements';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const newlyUnlocked = await checkAndUnlockAchievements(userId);

    // Send push for new unlocks
    if (newlyUnlocked.length > 0) {
      try { await sendAchievementNotification(userId, newlyUnlocked); } catch { /* silent */ }
    }

    const supabase = await createServerSupabaseClient();
    const { data: unlocked } = await supabase
      .from('user_achievements')
      .select('achievement, unlocked_at')
      .eq('user_id', userId);

    const unlockedMap = new Map(
      (unlocked || []).map((a: { achievement: string; unlocked_at: string }) => [a.achievement, a.unlocked_at])
    );

    // Return key, icon, category only — names come from translation files on client
    const all = ACHIEVEMENTS.map((a) => ({
      key: a.key,
      icon: a.icon,
      category: a.category,
      unlocked: unlockedMap.has(a.key),
      unlocked_at: unlockedMap.get(a.key) || null,
    }));

    return NextResponse.json({ achievements: all, newly_unlocked: newlyUnlocked }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Achievements error:', err);
    return NextResponse.json({ achievements: [], newly_unlocked: [] }, { headers: NO_CACHE });
  }
}

async function sendAchievementNotification(userId: string, unlockedKeys: string[]) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return;

  let webpush: typeof import('web-push');
  try { webpush = await import('web-push'); } catch { return; }
  webpush.setVapidDetails('mailto:info@hypesamba.com', vapidPublic, vapidPrivate);

  const supabase = await createServerSupabaseClient();
  const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth_key').eq('user_id', userId);
  if (!subs || subs.length === 0) return;

  const achievement = ACHIEVEMENTS.find((a) => a.key === unlockedKeys[0]);
  if (!achievement) return;

  const payload = JSON.stringify({
    title: `${achievement.icon} Prestatie ontgrendeld!`,
    body: achievement.key,
    tag: 'paywatch-achievement',
    url: '/instellingen',
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload);
    } catch (err) {
      if (err instanceof Error && (err.message.includes('410') || err.message.includes('404'))) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }
}
