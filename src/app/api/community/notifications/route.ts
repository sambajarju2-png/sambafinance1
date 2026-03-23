import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/community/notifications — fetch unread community notifications
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    const { data: notifications, error } = await supabase
      .from('community_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });

    return NextResponse.json({
      notifications: notifications || [],
      count: notifications?.length || 0,
    }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

/**
 * PATCH /api/community/notifications — mark notification(s) as read
 * Body: { id: string } (single) or { ids: string[] } (batch) or { all: true } (mark all)
 */
export async function PATCH(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();
    const supabase = await createServerSupabaseClient();

    if (body.all === true) {
      // Mark all as read
      await supabase
        .from('community_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    } else if (body.id) {
      // Mark single as read
      await supabase
        .from('community_notifications')
        .update({ is_read: true })
        .eq('id', body.id)
        .eq('user_id', userId);
    } else if (body.ids && Array.isArray(body.ids)) {
      // Mark batch as read
      await supabase
        .from('community_notifications')
        .update({ is_read: true })
        .in('id', body.ids)
        .eq('user_id', userId);
    }

    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
