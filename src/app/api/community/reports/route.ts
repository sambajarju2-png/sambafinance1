import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const AUTO_FLAG_THRESHOLD = 3; // Auto-flag after 3 reports

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();
    const { post_id, comment_id, reason, details } = body;

    if (!post_id && !comment_id) {
      return NextResponse.json({ error: 'post_id or comment_id required' }, { status: 400, headers: NO_CACHE });
    }
    if (!reason || typeof reason !== 'string') {
      return NextResponse.json({ error: 'reason required' }, { status: 400, headers: NO_CACHE });
    }

    const supabase = await createServerSupabaseClient();

    // Check for duplicate report
    let existingQuery = supabase
      .from('community_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_user_id', userId);

    if (post_id) existingQuery = existingQuery.eq('post_id', post_id);
    if (comment_id) existingQuery = existingQuery.eq('comment_id', comment_id);

    const { count: existingCount } = await existingQuery;
    if ((existingCount || 0) > 0) {
      return NextResponse.json({ error: 'Je hebt dit al gemeld' }, { status: 409, headers: NO_CACHE });
    }

    // Don't let users report their own content
    if (post_id) {
      const { data: post } = await supabase.from('community_posts').select('user_id').eq('id', post_id).single();
      if (post?.user_id === userId) {
        return NextResponse.json({ error: 'Je kunt je eigen post niet melden' }, { status: 400, headers: NO_CACHE });
      }
    }
    if (comment_id) {
      const { data: comment } = await supabase.from('community_comments').select('user_id').eq('id', comment_id).single();
      if (comment?.user_id === userId) {
        return NextResponse.json({ error: 'Je kunt je eigen reactie niet melden' }, { status: 400, headers: NO_CACHE });
      }
    }

    // Insert report
    const { error: insertError } = await supabase.from('community_reports').insert({
      reporter_user_id: userId,
      post_id: post_id || null,
      comment_id: comment_id || null,
      reason,
      details: details?.trim() || null,
      status: 'pending',
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500, headers: NO_CACHE });
    }

    // Auto-flag if threshold reached
    if (post_id) {
      const { count: reportCount } = await supabase
        .from('community_reports')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', post_id)
        .eq('status', 'pending');

      if ((reportCount || 0) >= AUTO_FLAG_THRESHOLD) {
        await supabase.from('community_posts').update({ is_flagged: true }).eq('id', post_id);
      }
    }

    if (comment_id) {
      const { count: reportCount } = await supabase
        .from('community_reports')
        .select('id', { count: 'exact', head: true })
        .eq('comment_id', comment_id)
        .eq('status', 'pending');

      if ((reportCount || 0) >= AUTO_FLAG_THRESHOLD) {
        await supabase.from('community_comments').update({ is_flagged: true }).eq('id', comment_id);
      }
    }

    return NextResponse.json({ ok: true }, { status: 201, headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
