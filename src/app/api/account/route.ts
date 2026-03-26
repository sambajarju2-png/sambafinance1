import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * DELETE /api/account
 * Permanently deletes ALL user data from ALL tables.
 *
 * SECURITY FIX: 
 * - Now uses service role client (old version used anon client which silently
 *   failed on tables with service-role-only RLS policies like ai_usage_log, rate_limits)
 * - Now covers ALL 26 tables with user_id column (old version missed 13)
 * - Also handles user_buddies.buddy_user_id and community_reports.reporter_user_id
 */
export async function DELETE() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    // Use service role to bypass RLS — ensures all tables are actually cleaned
    const supabase = createServiceRoleClient();

    // Delete from all user-specific tables in dependency order (children first)
    // Community tables (have FK dependencies between them)
    await supabase.from('community_reactions').delete().eq('user_id', userId);
    await supabase.from('community_reports').delete().eq('reporter_user_id', userId);
    await supabase.from('community_notifications').delete().eq('user_id', userId);
    await supabase.from('community_comments').delete().eq('user_id', userId);
    await supabase.from('community_posts').delete().eq('user_id', userId);
    await supabase.from('community_profiles').delete().eq('user_id', userId);

    // Buddy relationships (both directions)
    await supabase.from('user_buddies').delete().eq('user_id', userId);
    await supabase.from('user_buddies').delete().eq('buddy_user_id', userId);

    // AI & scanning
    await supabase.from('ai_usage_log').delete().eq('user_id', userId);
    await supabase.from('ai_extraction_corrections').delete().eq('user_id', userId);
    await supabase.from('scan_processed').delete().eq('user_id', userId);

    // Achievements & mood
    await supabase.from('user_achievements').delete().eq('user_id', userId);
    await supabase.from('mood_log').delete().eq('user_id', userId);
    await supabase.from('mood_analytics').delete().eq('user_id', userId);

    // Notifications & push
    await supabase.from('notification_log').delete().eq('user_id', userId);
    await supabase.from('push_subscriptions').delete().eq('user_id', userId);

    // Bills & related
    await supabase.from('bills').delete().eq('user_id', userId);
    await supabase.from('recurring_patterns').delete().eq('user_id', userId);
    await supabase.from('vendor_directory').delete().eq('user_id', userId);

    // Email accounts & OAuth states
    await supabase.from('gmail_accounts').delete().eq('user_id', userId);
    await supabase.from('gmail_oauth_states').delete().eq('user_id', userId);
    await supabase.from('outlook_accounts').delete().eq('user_id', userId);
    await supabase.from('outlook_oauth_states').delete().eq('user_id', userId);

    // User preferences & metadata
    await supabase.from('user_feedback').delete().eq('user_id', userId);
    await supabase.from('consent_log').delete().eq('user_id', userId);
    await supabase.from('custom_categories').delete().eq('user_id', userId);
    await supabase.from('rate_limits').delete().eq('user_id', userId);

    // User settings last (other tables may reference user_id via FK)
    await supabase.from('user_settings').delete().eq('user_id', userId);

    // Delete the Supabase Auth user itself
    await supabase.auth.admin.deleteUser(userId);

    return NextResponse.json({ ok: true, message: 'Account and all data permanently deleted' }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500, headers: NO_CACHE });
  }
}
