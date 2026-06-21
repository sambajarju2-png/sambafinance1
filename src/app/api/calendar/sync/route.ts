import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { verifyCsrf } from '@/lib/csrf';
import { reconcileUser } from '@/lib/calendar/sync';

/** POST /api/calendar/sync — reconcile this user's calendar with their bills now. */
export async function POST() {
  try { await verifyCsrf(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = createServiceRoleClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app';
  const result = await reconcileUser(supabase, userId, appUrl);

  if (!result) return NextResponse.json({ error: 'not_connected' }, { status: 400, headers: NO_CACHE });
  if (result.reauth) return NextResponse.json({ error: 'reauth' }, { status: 409, headers: NO_CACHE });
  return NextResponse.json({ ok: true, ...result }, { headers: NO_CACHE });
}
