import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

/** GET /api/calendar/status — connection state for the settings UI (no tokens). */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = createServiceRoleClient();
  const { data: conn } = await supabase
    .from('calendar_connections')
    .select('account_email, sync_enabled, needs_reauth, last_synced_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();

  if (!conn) return NextResponse.json({ connected: false }, { headers: NO_CACHE });

  const { count } = await supabase
    .from('calendar_synced_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  return NextResponse.json(
    {
      connected: true,
      email: conn.account_email,
      sync_enabled: conn.sync_enabled,
      needs_reauth: conn.needs_reauth,
      last_synced_at: conn.last_synced_at,
      synced_count: count || 0,
    },
    { headers: NO_CACHE },
  );
}
