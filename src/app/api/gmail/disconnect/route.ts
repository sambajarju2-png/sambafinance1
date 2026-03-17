import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/gmail/disconnect
 * Removes a connected Gmail account and its tokens.
 * Body: { account_id: string }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    const { account_id } = await req.json();

    if (!account_id) {
      return NextResponse.json({ error: 'account_id is required' }, { status: 400, headers: NO_CACHE });
    }

    const supabase = await createServerSupabaseClient();

    // Delete the Gmail account (RLS ensures user can only delete their own)
    const { error } = await supabase
      .from('gmail_accounts')
      .delete()
      .eq('id', account_id)
      .eq('user_id', userId);

    if (error) {
      console.error('Gmail disconnect error:', error);
      return NextResponse.json({ error: 'Failed to disconnect account' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ success: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_CACHE });
  }
}
