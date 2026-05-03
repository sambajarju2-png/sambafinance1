import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/voice/log-call
 * Records seconds used after a PayBuddy call ends.
 * Body: { seconds: number }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  let seconds = 0;
  try {
    const body = await req.json();
    seconds = Math.max(0, Math.min(Math.floor(Number(body.seconds)), 7200));
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: NO_CACHE });
  }

  if (seconds < 5) {
    return NextResponse.json({ ok: true, skipped: true }, { headers: NO_CACHE });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const { data: settings } = await supabase
      .from('user_settings')
      .select('voice_seconds_used, voice_seconds_reset_at, plan')
      .eq('user_id', userId)
      .single();

    if (!settings) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const needsReset = new Date(settings.voice_seconds_reset_at) < new Date(monthStart);
    const currentUsed = needsReset ? 0 : (settings.voice_seconds_used || 0);
    const newUsed = currentUsed + seconds;

    await supabase
      .from('user_settings')
      .update({
        voice_seconds_used: newUsed,
        ...(needsReset ? { voice_seconds_reset_at: monthStart } : {}),
      })
      .eq('user_id', userId);

    return NextResponse.json({ ok: true, seconds_logged: seconds, total_this_month: newUsed }, { headers: NO_CACHE });
  } catch (err) {
    console.error('[voice/log-call]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
