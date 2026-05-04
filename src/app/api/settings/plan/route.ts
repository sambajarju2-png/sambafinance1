import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('user_settings')
    .select('plan')
    .eq('user_id', userId)
    .single();
  return NextResponse.json({ plan: data?.plan || 'gratis' }, { headers: NO_CACHE });
}
