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

  const filter = req.nextUrl.searchParams.get('filter') || 'all';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 50);

  // Fetch posts
  let postsQuery = supabase
    .from('community_posts')
    .select('*')
    .eq('is_approved', true)
    .eq('is_flagged', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter === 'succesverhalen') {
    postsQuery = postsQuery.eq('badge_type', 'milestone');
  } else if (filter === 'tips') {
    postsQuery = postsQuery.eq('badge_type', 'tip');
  } else if (filter === 'steun') {
    postsQuery = postsQuery.is('badge_type', null);
  }

  const { data: posts, error: postsError } = await postsQuery;
  if (postsError) return NextResponse.json({ error: postsError.message }, { status: 500, headers: NO_CACHE });
  if (!posts || posts.length === 0) return NextResponse.json({ posts: [] }, { headers: NO_CACHE });

  // Fetch profiles for all post authors
  const userIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: profiles } = await supabase
    .from('community_profiles')
    .select('user_id, display_name')
    .in('user_id', userIds);

  const profileMap: Record<string, string> = {};
  for (const p of profiles || []) {
    profileMap[p.user_id] = p.display_name;
  }

  // Fetch reactions for all posts
  const postIds = posts.map((p) => p.id);
  const { data: reactions } = await supabase
    .from('community_reactions')
    .select('post_id, reaction_type, user_id')
    .in('post_id', postIds);

  // Group reactions by post
  const reactionsByPost: Record<string, Array<{ reaction_type: string; user_id: string }>> = {};
  for (const r of reactions || []) {
    if (!reactionsByPost[r.post_id]) reactionsByPost[r.post_id] = [];
    reactionsByPost[r.post_id].push(r);
  }

  // Enrich posts
  const enriched = posts.map((post) => {
    const postReactions = reactionsByPost[post.id] || [];
    const reactionCounts: Record<string, number> = {};
    const userReactions: string[] = [];

    for (const r of postReactions) {
      reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
      if (r.user_id === user.id) userReactions.push(r.reaction_type);
    }

    return {
      id: post.id,
      content: post.content,
      is_anonymous: post.is_anonymous,
      badge_type: post.badge_type,
      badge_data: post.badge_data,
      created_at: post.created_at,
      display_name: post.is_anonymous ? 'Anoniem' : (profileMap[post.user_id] || 'Gebruiker'),
      user_id: post.user_id,
      reaction_counts: reactionCounts,
      user_reactions: userReactions,
      total_reactions: postReactions.length,
    };
  });

  return NextResponse.json({ posts: enriched }, { headers: NO_CACHE });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const body = await req.json();
  const content = (body.content || '').trim();
  if (!content || content.length < 3) return NextResponse.json({ error: 'Content too short' }, { status: 400, headers: NO_CACHE });
  if (content.length > 500) return NextResponse.json({ error: 'Content too long' }, { status: 400, headers: NO_CACHE });
  if (containsBlockedWords(content)) return NextResponse.json({ error: 'Ongepaste taal gedetecteerd' }, { status: 400, headers: NO_CACHE });

  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      user_id: user.id,
      content,
      is_anonymous: body.is_anonymous || false,
      badge_type: body.badge_type || null,
      badge_data: body.badge_data || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ post: data }, { status: 201, headers: NO_CACHE });
}
