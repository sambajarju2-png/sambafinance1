import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/mood
 *
 * Returns today's mood (if set) for the logged-in user.
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: mood } = await supabase
    .from('mood_log')
    .select('mood, logged_at')
    .eq('user_id', userId)
    .eq('logged_at', today)
    .maybeSingle();

  return NextResponse.json({
    mood: mood?.mood || null,
    logged_today: !!mood,
  }, { headers: NO_CACHE });
}

/**
 * POST /api/mood
 *
 * Save today's mood. If already set, updates it.
 * Body: { mood: 'angstig' | 'gestrest' | 'neutraal' | 'opgelucht' | 'blij' }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  const body = await req.json();
  const { mood } = body;

  const validMoods = ['angstig', 'gestrest', 'neutraal', 'opgelucht', 'blij'];
  if (!mood || !validMoods.includes(mood)) {
    return NextResponse.json({ error: 'Invalid mood' }, { status: 400, headers: NO_CACHE });
  }

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  // Upsert: insert or update today's mood
  const { error } = await supabase
    .from('mood_log')
    .upsert(
      { user_id: userId, mood, logged_at: today },
      { onConflict: 'user_id,logged_at' }
    );

  if (error) {
    console.error('Mood save error:', error);
    return NextResponse.json({ error: 'Failed to save mood' }, { status: 500, headers: NO_CACHE });
  }

  return NextResponse.json({ ok: true, mood }, { headers: NO_CACHE });
}
