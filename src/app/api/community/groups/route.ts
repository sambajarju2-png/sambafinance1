import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' };

// GET /api/community/groups — the sub-communities the current user belongs to.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ groups: [] }, { status: 401, headers: NO_CACHE });

  const { data: memberships } = await supabase
    .from('community_group_members')
    .select('group_id')
    .eq('user_id', user.id);
  const groupIds = (memberships || []).map((m: { group_id: string }) => m.group_id);
  if (groupIds.length === 0) return NextResponse.json({ groups: [] }, { headers: NO_CACHE });

  const { data: groups } = await supabase
    .from('community_groups')
    .select('id, name, organization_id, is_default')
    .in('id', groupIds)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  return NextResponse.json({ groups: groups || [] }, { headers: NO_CACHE });
}
