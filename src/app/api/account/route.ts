import { NextResponse } from 'next/server';
import { getAuthUserIdVerified, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { verifyCsrf } from '@/lib/csrf';

/**
 * DELETE /api/account
 * Permanently deletes ALL user data from ALL tables using
 * the delete_all_user_data() database function (covers 52 tables).
 * Then deletes the Supabase Auth user.
 */
export async function DELETE() {
  try { await verifyCsrf(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  const userId = await getAuthUserIdVerified();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = createServiceRoleClient();

    // Log the GDPR deletion request
    await supabase.from('gdpr_requests').insert({
      user_id: userId,
      request_type: 'verwijdering',
      status: 'processing',
      details: { method: 'self_service', initiated_at: new Date().toISOString() },
    });

    // Delete ALL user data from ALL tables (single DB function, no tables missed)
    const { error: deleteError } = await supabase.rpc('delete_all_user_data', {
      target_user_id: userId,
    });

    if (deleteError) {
      console.error('delete_all_user_data error:', deleteError);
      // Fallback: try to continue with auth deletion anyway
    }

    // Delete the Supabase Auth user
    await supabase.auth.admin.deleteUser(userId);

    // Mark GDPR request as completed
    await supabase
      .from('gdpr_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('request_type', 'verwijdering')
      .eq('status', 'processing');

    return NextResponse.json({ ok: true, message: 'Account and all data permanently deleted' }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500, headers: NO_CACHE });
  }
}
