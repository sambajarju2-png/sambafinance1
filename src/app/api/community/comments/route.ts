import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' };

const BLOCKED_WORDS = ['kanker', 'tering', 'tyfus', 'hoer', 'kut', 'fuck', 'shit'];
function containsBlockedWords(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  is_anonymous: boolean;
  is_flagged: boolean;
  parent_comment_id: string | null;
  created_at: string;
}

interface ThreadedComment {
  id: string;
  content: string;
  is_anonymous: boolean;
  display_name: string;
  user_id: string;
  created_at: string;
  parent_comment_id: string | null;
  replies: ThreadedComment[];
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const postId = req.nextUrl.searchParams.get('post_id');
  if (!postId) return NextResponse.json({ error: 'post_id required' }, { status: 400, headers: NO_CACHE });

  const { data: comments, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .eq('is_flagged', false)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  if (!comments || comments.length === 0) return NextResponse.json({ comments: [] }, { headers: NO_CACHE });

  // Fetch profiles
  const userIds = Array.from(new Set(comments.map((c: CommentRow) => c.user_id)));
  const { data: profiles } = await supabase
    .from('community_profiles')
    .select('user_id, display_name')
    .in('user_id', userIds);

  const profileMap: Record<string, string> = {};
  for (const p of profiles || []) profileMap[p.user_id] = p.display_name;

  // Build threaded structure
  const commentMap: Record<string, ThreadedComment> = {};
  const topLevel: ThreadedComment[] = [];

  for (const c of comments as CommentRow[]) {
    const tc: ThreadedComment = {
      id: c.id,
      content: c.content,
      is_anonymous: c.is_anonymous,
      display_name: c.is_anonymous ? 'Anoniem' : (profileMap[c.user_id] || 'Gebruiker'),
      user_id: c.user_id,
      created_at: c.created_at,
      parent_comment_id: c.parent_comment_id,
      replies: [],
    };
    commentMap[c.id] = tc;
  }

  for (const c of comments as CommentRow[]) {
    const tc = commentMap[c.id];
    if (c.parent_comment_id && commentMap[c.parent_comment_id]) {
      commentMap[c.parent_comment_id].replies.push(tc);
    } else {
      topLevel.push(tc);
    }
  }

  return NextResponse.json({ comments: topLevel }, { headers: NO_CACHE });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const body = await req.json();
  const content = (body.content || '').trim();
  const postId = body.post_id;
  const parentCommentId = body.parent_comment_id || null;

  if (!postId) return NextResponse.json({ error: 'post_id required' }, { status: 400, headers: NO_CACHE });
  if (!content || content.length < 1) return NextResponse.json({ error: 'Content too short' }, { status: 400, headers: NO_CACHE });
  if (content.length > 300) return NextResponse.json({ error: 'Content too long (max 300)' }, { status: 400, headers: NO_CACHE });
  if (containsBlockedWords(content)) return NextResponse.json({ error: 'Ongepaste taal gedetecteerd' }, { status: 400, headers: NO_CACHE });

  const { data, error } = await supabase
    .from('community_comments')
    .insert({
      post_id: postId,
      user_id: user.id,
      content,
      is_anonymous: body.is_anonymous || false,
      parent_comment_id: parentCommentId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ comment: data }, { status: 201, headers: NO_CACHE });
}
