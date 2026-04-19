import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('user_settings')
    .select('first_name, language, gemeente, scan_preference')
    .eq('user_id', userId)
    .single();

  return NextResponse.json(data || { first_name: '', language: 'nl', gemeente: '', scan_preference: 'email' });
}
