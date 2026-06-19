import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Mark all of the current user's assisted-change records as seen.
export async function POST() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401, headers: NO_CACHE });
  try {
    const supabase = await createServerSupabaseClient();
    await supabase
      .from('assisted_changes')
      .update({ seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('seen_at', null);
    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_CACHE });
  }
}
