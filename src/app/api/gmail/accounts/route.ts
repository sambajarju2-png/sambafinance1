import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/gmail/accounts
 * Returns the user's connected Gmail accounts (without tokens).
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    const supabase = await createServerSupabaseClient();

    const { data: accounts, error } = await supabase
      .from('gmail_accounts')
      .select('id, email, last_scanned, scan_progress, full_scan_complete, needs_reauth, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Gmail accounts fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ accounts: accounts || [] }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: NO_CACHE });
  }
}
