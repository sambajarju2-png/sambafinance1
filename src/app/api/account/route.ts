import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * DELETE /api/account
 * Permanently deletes all user data from all tables.
 * Does NOT delete the Supabase Auth user (that requires admin SDK).
 */
export async function DELETE() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    // Delete from all user-specific tables in order (child tables first)
    const tables = [
      'user_achievements',
      'push_subscriptions',
      'recurring_patterns',
      'scan_processed',
      'mood_log',
      'notification_log',
      'user_feedback',
      'consent_log',
      'bills',
      'gmail_accounts',
      'user_settings',
    ];

    for (const table of tables) {
      await supabase.from(table).delete().eq('user_id', userId);
    }

    // Also delete from ai_usage_log and rate_limits
    await supabase.from('ai_usage_log').delete().eq('user_id', userId);
    await supabase.from('rate_limits').delete().eq('user_id', userId);

    return NextResponse.json({ ok: true, message: 'Account data deleted' }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500, headers: NO_CACHE });
  }
}
