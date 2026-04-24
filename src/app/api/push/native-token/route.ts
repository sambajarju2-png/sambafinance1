import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/push/native-token
 * Saves native push token (APNs for iOS, FCM for Android)
 * Called by NativeShell on app startup after push registration
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { token, platform } = await req.json();

    if (!token || !platform) {
      return NextResponse.json({ error: 'token and platform required' }, { status: 400, headers: NO_CACHE });
    }

    if (!['ios', 'android'].includes(platform)) {
      return NextResponse.json({ error: 'platform must be ios or android' }, { status: 400, headers: NO_CACHE });
    }

    const supabase = await createServerSupabaseClient();

    // Upsert — one token per user per platform
    const { error } = await supabase
      .from('native_push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform' }
      );

    if (error) {
      console.error('[native-token] Upsert error:', error);
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch (err) {
    console.error('[native-token] Error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

/**
 * DELETE /api/push/native-token
 * Removes native push token (on logout or token refresh)
 */
export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { platform } = await req.json();
    const supabase = await createServerSupabaseClient();

    await supabase
      .from('native_push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform || 'ios');

    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
