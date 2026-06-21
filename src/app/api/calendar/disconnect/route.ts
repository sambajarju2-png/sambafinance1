import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { verifyCsrf } from '@/lib/csrf';
import { getValidAccessToken } from '@/lib/calendar/tokens';
import { deleteCalendar } from '@/lib/calendar/google';

/** POST /api/calendar/disconnect — removes the dedicated calendar and all sync state. */
export async function POST(req: NextRequest) {
  try { await verifyCsrf(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = createServiceRoleClient();
  const { data: conn } = await supabase
    .from('calendar_connections')
    .select('id, calendar_id')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();

  if (conn) {
    if (conn.calendar_id) {
      const token = await getValidAccessToken(supabase, conn.id);
      if (token) {
        try { await deleteCalendar(token, conn.calendar_id); } catch { /* non-fatal */ }
      }
    }
    await supabase.from('calendar_synced_events').delete().eq('connection_id', conn.id);
    await supabase.from('calendar_connections').delete().eq('id', conn.id);
    await supabase
      .from('consent_log')
      .insert({
        user_id: userId,
        consent_type: 'calendar_connection',
        granted: false,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || null,
        user_agent: req.headers.get('user-agent') || null,
      })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true }, { headers: NO_CACHE });
}
