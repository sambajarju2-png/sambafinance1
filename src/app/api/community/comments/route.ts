import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' };

const BLOCKED_WORDS = ['kanker', 'tering', 'tyfus', 'hoer', 'kut', 'fuck', 'shit'];
function containsBlockedWords(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
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
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  if (!comments || comments.length === 0) return NextResponse.json({ comments: [] }, { headers: NO_CACHE });

  const userIds = Array.from(new Set(comments.map((c) => c.user_id)));
  const { data: profiles } = await supabase
    .from('community_profiles')
    .select('user_id, display_name')
    .in('user_id', userIds);

  const profileMap: Record<string, string> = {};
  for (const p of profiles || []) profileMap[p.user_id] = p.display_name;

  const enriched = comments.map((c) => ({
    id: c.id,
    content: c.content,
    is_anonymous: c.is_anonymous,
    display_name: c.is_anonymous ? 'Anoniem' : (profileMap[c.user_id] || 'Gebruiker'),
    user_id: c.user_id,
    is_own: c.user_id === user.id,
    created_at: c.created_at,
  }));

  return NextResponse.json({ comments: enriched }, { headers: NO_CACHE });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const body = await req.json();
  const content = (body.content || '').trim();
  const postId = body.post_id;

  if (!postId) return NextResponse.json({ error: 'post_id required' }, { status: 400, headers: NO_CACHE });
  if (!content || content.length < 1) return NextResponse.json({ error: 'Content too short' }, { status: 400, headers: NO_CACHE });
  if (content.length > 300) return NextResponse.json({ error: 'Content too long (max 300)' }, { status: 400, headers: NO_CACHE });
  if (containsBlockedWords(content)) return NextResponse.json({ error: 'Ongepaste taal gedetecteerd' }, { status: 400, headers: NO_CACHE });

  const { data, error } = await supabase
    .from('community_comments')
    .insert({ post_id: postId, user_id: user.id, content, is_anonymous: body.is_anonymous || false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ comment: data }, { status: 201, headers: NO_CACHE });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const { id, content } = await req.json();
  if (!id || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: NO_CACHE });
  if (containsBlockedWords(content)) return NextResponse.json({ error: 'Ongepaste taal gedetecteerd' }, { status: 400, headers: NO_CACHE });

  const { error } = await supabase.from('community_comments').update({ content: content.trim() }).eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ success: true }, { headers: NO_CACHE });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: NO_CACHE });

  const { error } = await supabase.from('community_comments').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ success: true }, { headers: NO_CACHE });
}
