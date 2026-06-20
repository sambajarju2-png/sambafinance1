import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getGrantedFeatures } from '@/lib/org-features-server';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ count: 0, items: [] }, { headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();
    const granted = await getGrantedFeatures(createServiceRoleClient(), userId);
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

    // Community notifications (unread mentions)
    const { data: communityNotifs } = await supabase
      .from('community_notifications')
      .select('id, type, from_display_name, post_id, comment_id, content_preview, created_at, group_id')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);

    // Assisted changes — data an organisation updated on the user's behalf (unseen)
    const { data: assistedChanges } = await supabase
      .from('assisted_changes')
      .select('id, change_type, details, org_name, created_at')
      .eq('user_id', userId)
      .is('seen_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    const items: Array<{ type: string; data: unknown }> = [];

    if (granted.escalation_alerts) {
      for (const bill of (overdueBills || [])) {
        items.push({ type: 'overdue', data: bill });
      }
      for (const bill of (upcomingBills || [])) {
        items.push({ type: 'upcoming', data: bill });
      }
    }
    for (const ach of (recentAchievements || [])) {
      items.push({ type: 'achievement', data: ach });
    }
    for (const notif of (communityNotifs || [])) {
      items.push({ type: notif.type === 'announcement' ? 'announcement' : 'mention', data: notif });
    }
    for (const ch of (assistedChanges || [])) {
      items.push({ type: 'assisted', data: ch });
    }

    const overdueCount = granted.escalation_alerts ? (overdueBills?.length || 0) : 0;
    const count = overdueCount + (recentAchievements?.length || 0) + (communityNotifs?.length || 0) + (assistedChanges?.length || 0);

    return NextResponse.json({
      count,
      items,
      overdue: overdueCount,
      achievements: recentAchievements?.length || 0,
      mentions: communityNotifs?.length || 0,
      assisted: assistedChanges?.length || 0,
    }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ count: 0, items: [] }, { headers: NO_CACHE });
  }
}
