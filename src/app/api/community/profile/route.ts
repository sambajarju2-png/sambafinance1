import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' };

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const { data: profile } = await supabase
    .from('community_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ profile: profile || null }, { headers: NO_CACHE });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const body = await req.json();
  const displayName = (body.display_name || '').trim().slice(0, 30);
  if (!displayName) return NextResponse.json({ error: 'Name required' }, { status: 400, headers: NO_CACHE });

  const { data, error } = await supabase
    .from('community_profiles')
    .upsert({
      user_id: user.id,
      display_name: displayName,
      is_anonymous_default: body.is_anonymous_default || false,
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ profile: data }, { headers: NO_CACHE });
}
