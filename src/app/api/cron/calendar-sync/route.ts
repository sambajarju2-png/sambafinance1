import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reconcileConnection } from '@/lib/calendar/sync';

/**
 * GET /api/cron/calendar-sync
 * Reconciles every active Google Calendar connection with the user's bills:
 * creates events for new bills, shifts them when due dates change, and removes
 * them when bills are paid/settled/deleted. This is the safety net + the
 * delete-on-paid mechanism.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app';

  const { data: connections } = await supabase
    .from('calendar_connections')
    .select('id, user_id, calendar_id')
    .eq('provider', 'google')
    .eq('sync_enabled', true)
    .eq('needs_reauth', false);

  let processed = 0;
  let created = 0;
  let updated = 0;
  let deleted = 0;
  let reauth = 0;
  let errors = 0;

  for (const conn of (connections || []) as Array<{ id: string; user_id: string; calendar_id: string | null }>) {
    try {
      const r = await reconcileConnection(supabase, conn, appUrl);
      processed++;
      if (r.reauth) reauth++;
      created += r.created;
      updated += r.updated;
      deleted += r.deleted;
      errors += r.errors;
    } catch (e) {
      console.error('[cron/calendar-sync] connection failed', conn.id, e);
      errors++;
    }
  }

  return NextResponse.json({ ok: true, processed, created, updated, deleted, reauth, errors });
}
