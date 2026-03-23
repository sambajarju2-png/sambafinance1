import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' };
const VALID_REACTIONS = ['heart', 'goed', 'trots', 'top'];

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const body = await req.json();
  const { post_id, reaction_type } = body;

  if (!post_id || !reaction_type) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: NO_CACHE });
  if (!VALID_REACTIONS.includes(reaction_type)) return NextResponse.json({ error: 'Invalid reaction' }, { status: 400, headers: NO_CACHE });

  // Check if already reacted — toggle off
  const { data: existing } = await supabase
    .from('community_reactions')
    .select('id')
    .eq('post_id', post_id)
    .eq('user_id', user.id)
    .eq('reaction_type', reaction_type)
    .single();

  if (existing) {
    await supabase.from('community_reactions').delete().eq('id', existing.id);
    return NextResponse.json({ action: 'removed' }, { headers: NO_CACHE });
  }

  const { error } = await supabase
    .from('community_reactions')
    .insert({ post_id, user_id: user.id, reaction_type });

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ action: 'added' }, { status: 201, headers: NO_CACHE });
}
