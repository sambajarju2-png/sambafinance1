import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

// Org types that may receive a wellbeing flag. Collection orgs (incasso) are
// NEVER eligible. This is also enforced by a DB trigger as defense in depth,
// so a bug here can never leak distress to a collector.
const SUPPORT_ORG_TYPES = ['gemeente', 'hulporganisatie'];

type Severity = 'struggling' | 'unsafe';
type Source = 'checkin_call' | 'user_initiated';

/**
 * POST /api/checkin/flag
 * Backend for the `flag_for_support` client tool, and for the user-initiated
 * "vraag of mijn hulpverlener contact opneemt" button.
 *
 * Resolves the user's linked SUPPORT org(s) and records an async wellbeing
 * flag the professional picks up on the B2B side. Never reaches a collection
 * (incasso) org. Stores no emotional detail and no transcript.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  let body: { severity?: Severity; reason?: string; source?: Source };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: NO_CACHE });
  }

  const severity = body.severity;
  if (severity !== 'struggling' && severity !== 'unsafe') {
    return NextResponse.json({ error: 'severity must be "struggling" or "unsafe"' }, { status: 400, headers: NO_CACHE });
  }
  const source: Source = body.source === 'user_initiated' ? 'user_initiated' : 'checkin_call';
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;

  // Service role: trusted server write. RLS is bypassed, but the DB trigger
  // still blocks any non-support org.
  const admin = createServiceRoleClient();

  // Resolve the user's ACTIVE support orgs (two queries — no reliance on
  // PostgREST relationship inference).
  const { data: links, error: linkErr } = await admin
    .from('user_organizations')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (linkErr) {
    console.error('[checkin/flag] org link lookup failed:', linkErr);
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500, headers: NO_CACHE });
  }

  const orgIds = (links || []).map((l: { organization_id: string }) => l.organization_id);
  if (orgIds.length === 0) {
    console.warn(`[checkin/flag] user ${userId} has no active org (severity=${severity})`);
    return NextResponse.json({ flagged: false, reason: 'no_org' }, { headers: NO_CACHE });
  }

  const { data: orgs, error: orgErr } = await admin
    .from('organizations')
    .select('id, type')
    .in('id', orgIds);

  if (orgErr) {
    console.error('[checkin/flag] org type lookup failed:', orgErr);
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500, headers: NO_CACHE });
  }

  const supportOrgIds = (orgs || [])
    .filter((o: { id: string; type: string }) => SUPPORT_ORG_TYPES.includes(o.type))
    .map((o: { id: string }) => o.id);

  // No support org linked: nothing to flag. For `unsafe` the in-call 113 line
  // already handled the user-facing safety; here we simply have no professional
  // to notify.
  if (supportOrgIds.length === 0) {
    console.warn(`[checkin/flag] user ${userId} has no linked SUPPORT org (severity=${severity})`);
    return NextResponse.json({ flagged: false, reason: 'no_support_org' }, { headers: NO_CACHE });
  }

  const rows = supportOrgIds.map((orgId: string) => ({
    user_id: userId,
    organization_id: orgId,
    severity,
    reason,
    source,
  }));

  const { data: inserted, error: insErr } = await admin
    .from('checkin_support_flags')
    .insert(rows)
    .select('id, organization_id');

  if (insErr) {
    console.error('[checkin/flag] insert failed:', insErr);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500, headers: NO_CACHE });
  }

  // TODO(v1): notify each org (Resend / in-app) that a new flag is waiting.
  // The flag already surfaces on the B2B portal triage queue.

  return NextResponse.json({
    flagged: true,
    count: inserted?.length || 0,
    message: 'Doorgegeven aan de hulpverlener.',
  }, { headers: NO_CACHE });
}
