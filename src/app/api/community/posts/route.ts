import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' };

// Simple keyword filter for moderation
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

  let query = supabase
    .from('community_posts')
    .select('*, community_profiles(display_name), community_reactions(id, reaction_type, user_id)')
    .eq('is_approved', true)
    .eq('is_flagged', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter === 'succesverhalen') {
    query = query.eq('badge_type', 'milestone');
  } else if (filter === 'tips') {
    query = query.eq('badge_type', 'tip');
  } else if (filter === 'steun') {
    query = query.is('badge_type', null);
  }

  const { data: posts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });

  // Transform posts for client
  const enriched = (posts || []).map((post) => {
    const profile = Array.isArray(post.community_profiles) ? post.community_profiles[0] : post.community_profiles;
    const reactions = post.community_reactions || [];

    // Count reactions by type
    const reactionCounts: Record<string, number> = {};
    const userReactions: string[] = [];
    for (const r of reactions) {
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
      display_name: post.is_anonymous ? 'Anoniem' : (profile?.display_name || 'Gebruiker'),
      user_id: post.user_id,
      reaction_counts: reactionCounts,
      user_reactions: userReactions,
      total_reactions: reactions.length,
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
