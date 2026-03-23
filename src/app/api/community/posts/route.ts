import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkCommunityBan } from '@/lib/community-ban';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' };
const MAX_POSTS_PER_DAY = 3;

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

  if (filter === 'populair') {
    return getPopularPosts(supabase, user.id);
  }

  let postsQuery = supabase
    .from('community_posts')
    .select('*')
    .eq('is_approved', true)
    .eq('is_flagged', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter === 'succesverhalen') {
    postsQuery = postsQuery.in('badge_type', ['milestone', 'debt_free', 'streak']);
  } else if (filter === 'tips') {
    postsQuery = postsQuery.eq('badge_type', 'tip');
  } else if (filter === 'steun') {
    postsQuery = postsQuery.is('badge_type', null);
  }

  const { data: posts, error: postsError } = await postsQuery;
  if (postsError) return NextResponse.json({ error: postsError.message }, { status: 500, headers: NO_CACHE });
  if (!posts || posts.length === 0) return NextResponse.json({ posts: [] }, { headers: NO_CACHE });

  const enriched = await enrichPosts(supabase, posts, user.id);
  return NextResponse.json({ posts: enriched }, { headers: NO_CACHE });
}

async function getPopularPosts(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const { data: posts } = await supabase
    .from('community_posts')
    .select('*')
    .eq('is_approved', true)
    .eq('is_flagged', false)
    .gte('created_at', weekStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (!posts || posts.length === 0) return NextResponse.json({ posts: [], week_label: getWeekLabel(weekStart) }, { headers: NO_CACHE });

  const postIds = posts.map((p) => p.id);
  const [reactionsRes, commentsRes] = await Promise.all([
    supabase.from('community_reactions').select('post_id').in('post_id', postIds),
    supabase.from('community_comments').select('post_id').in('post_id', postIds).eq('is_flagged', false),
  ]);

  const rc: Record<string, number> = {};
  const cc: Record<string, number> = {};
  for (const r of reactionsRes.data || []) rc[r.post_id] = (rc[r.post_id] || 0) + 1;
  for (const c of commentsRes.data || []) cc[c.post_id] = (cc[c.post_id] || 0) + 1;

  const scored = posts.map((p) => ({ ...p, _score: (rc[p.id] || 0) + (cc[p.id] || 0) }));
  scored.sort((a, b) => b._score - a._score);

  const enriched = await enrichPosts(supabase, scored.slice(0, 10), userId);
  return NextResponse.json({ posts: enriched, week_label: getWeekLabel(weekStart) }, { headers: NO_CACHE });
}

function getWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${weekStart.toLocaleDateString('nl-NL', opts)} – ${weekEnd.toLocaleDateString('nl-NL', opts)}`;
}

async function enrichPosts(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  posts: Array<Record<string, unknown>>,
  userId: string
) {
  const userIds = Array.from(new Set(posts.map((p) => p.user_id as string)));
  const postIds = posts.map((p) => p.id as string);

  const [profilesRes, reactionsRes, commentsRes] = await Promise.all([
    supabase.from('community_profiles').select('user_id, display_name').in('user_id', userIds),
    supabase.from('community_reactions').select('post_id, reaction_type, user_id').in('post_id', postIds),
    supabase.from('community_comments').select('post_id').in('post_id', postIds).eq('is_flagged', false),
  ]);

  const profileMap: Record<string, string> = {};
  for (const p of profilesRes.data || []) profileMap[p.user_id] = p.display_name;

  const reactionsByPost: Record<string, Array<{ reaction_type: string; user_id: string }>> = {};
  for (const r of reactionsRes.data || []) {
    if (!reactionsByPost[r.post_id]) reactionsByPost[r.post_id] = [];
    reactionsByPost[r.post_id].push(r);
  }

  const commentCountByPost: Record<string, number> = {};
  for (const c of commentsRes.data || []) commentCountByPost[c.post_id] = (commentCountByPost[c.post_id] || 0) + 1;

  return posts.map((post) => {
    const postReactions = reactionsByPost[post.id as string] || [];
    const reactionCounts: Record<string, number> = {};
    const userReactions: string[] = [];
    for (const r of postReactions) {
      reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
      if (r.user_id === userId) userReactions.push(r.reaction_type);
    }
    return {
      id: post.id,
      content: post.content,
      is_anonymous: post.is_anonymous,
      badge_type: post.badge_type,
      badge_data: post.badge_data,
      created_at: post.created_at,
      display_name: post.is_anonymous ? 'Anoniem' : (profileMap[post.user_id as string] || 'Gebruiker'),
      user_id: post.user_id,
      is_own: post.user_id === userId,
      reaction_counts: reactionCounts,
      user_reactions: userReactions,
      total_reactions: postReactions.length,
      comment_count: commentCountByPost[post.id as string] || 0,
    };
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  // Check if user is banned from community
  const ban = await checkCommunityBan(user.id);
  if (ban.isBanned) {
    const msg = ban.until
      ? `Je bent geblokkeerd tot ${new Date(ban.until).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : 'Je bent geblokkeerd van de community';
    return NextResponse.json({ error: msg }, { status: 403, headers: NO_CACHE });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('community_posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString());

  if ((count || 0) >= MAX_POSTS_PER_DAY) {
    return NextResponse.json({
      error: 'daily_limit',
      message: `Je hebt vandaag al ${MAX_POSTS_PER_DAY} berichten geplaatst. Om spam te voorkomen en de community waardevol te houden, kun je maximaal ${MAX_POSTS_PER_DAY} berichten per dag plaatsen. Morgen kun je weer posten!`,
    }, { status: 429, headers: NO_CACHE });
  }

  const body = await req.json();
  const content = (body.content || '').trim();
  if (!content || content.length < 3) return NextResponse.json({ error: 'Content too short' }, { status: 400, headers: NO_CACHE });
  if (content.length > 500) return NextResponse.json({ error: 'Content too long' }, { status: 400, headers: NO_CACHE });
  if (containsBlockedWords(content)) return NextResponse.json({ error: 'Ongepaste taal gedetecteerd' }, { status: 400, headers: NO_CACHE });

  const { data, error } = await supabase
    .from('community_posts')
    .insert({ user_id: user.id, content, is_anonymous: body.is_anonymous || false, badge_type: body.badge_type || null, badge_data: body.badge_data || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ post: data }, { status: 201, headers: NO_CACHE });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const body = await req.json();
  const { id, content } = body;
  if (!id || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: NO_CACHE });
  if (containsBlockedWords(content)) return NextResponse.json({ error: 'Ongepaste taal gedetecteerd' }, { status: 400, headers: NO_CACHE });

  const { error } = await supabase.from('community_posts').update({ content: content.trim() }).eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ success: true }, { headers: NO_CACHE });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: NO_CACHE });

  const { error } = await supabase.from('community_posts').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ success: true }, { headers: NO_CACHE });
}
