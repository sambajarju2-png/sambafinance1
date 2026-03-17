import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  try {
    const { endpoint, p256dh, auth_key } = await req.json();
    if (!endpoint || !p256dh || !auth_key) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400, headers: NO_CACHE });
    }
    const supabase = await createServerSupabaseClient();
    await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint, p256dh, auth_key },
      { onConflict: 'user_id,endpoint' }
    );
    await supabase.from('user_settings').update({ notify_push_enabled: true }).eq('user_id', userId);
    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Push subscribe error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  try {
    const { endpoint } = await req.json();
    const supabase = await createServerSupabaseClient();
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
    const { data: remaining } = await supabase.from('push_subscriptions').select('id').eq('user_id', userId).limit(1);
    if (!remaining || remaining.length === 0) {
      await supabase.from('user_settings').update({ notify_push_enabled: false }).eq('user_id', userId);
    }
    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
