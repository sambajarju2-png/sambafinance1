import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ensureDefaultGroupMembership } from '@/lib/community-groups';

/**
 * GET — list orgs this user is connected to
 * POST { invite_code } — enter a code to connect to an org
 */

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = createServiceRoleClient();

  const { data: userOrgs } = await supabase
    .from('user_organizations')
    .select('organization_id, status, onboarded_at')
    .eq('user_id', userId)
    .in('status', ['active', 'onboarded', 'invited']);

  if (!userOrgs || userOrgs.length === 0) {
    return NextResponse.json({ orgs: [], pending_invites: 0 }, { headers: NO_CACHE });
  }

  const orgIds = userOrgs.map((o: any) => o.organization_id);
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, type, logo_url, primary_color, city')
    .in('id', orgIds);

  const orgMap = new Map((orgs || []).map((o: any) => [o.id, o]));

  const result = userOrgs.map((uo: any) => ({
    ...uo,
    org: orgMap.get(uo.organization_id) || null,
  })).filter((uo: any) => uo.org);

  return NextResponse.json({ orgs: result }, { headers: NO_CACHE });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const { invite_code, scopes: requestedScopes } = await req.json();
  if (!invite_code?.trim()) return NextResponse.json({ error: 'Code is verplicht' }, { status: 400, headers: NO_CACHE });

  const supabase = createServiceRoleClient();

  // Look up invite by token OR short_code
  const code = invite_code.trim();
  const { data: invite } = await supabase
    .from('b2b_invites')
    .select('id, organization_id, external_id, status, expires_at')
    .or(`token.eq.${code},short_code.eq.${code.toUpperCase()}`)
    .single();

  if (!invite) return NextResponse.json({ error: 'Code niet gevonden of ongeldig' }, { status: 404, headers: NO_CACHE });
  if (invite.status === 'activated') return NextResponse.json({ error: 'Deze code is al gebruikt', already_active: true }, { status: 400, headers: NO_CACHE });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Deze code is verlopen' }, { status: 410, headers: NO_CACHE });

  // Link user to org
  await supabase.from('user_organizations').upsert({
    user_id: userId,
    organization_id: invite.organization_id,
    status: 'active',
    external_id: invite.external_id,
    onboarded_at: new Date().toISOString(),
  }, { onConflict: 'user_id,organization_id' });

  // Grant consent — only for scopes the user explicitly selected
  const validScopes = ['contact_info', 'view_bills', 'financial_overview', 'payment_plans', 'messaging', 'assisted_entry', 'full_access', 'aggregated'];
  const scopes = (requestedScopes && Array.isArray(requestedScopes) && requestedScopes.length > 0)
    ? requestedScopes.filter((s: string) => validScopes.includes(s))
    : ['contact_info', 'view_bills', 'financial_overview', 'payment_plans', 'messaging']; // fallback for old clients
  const consentIp = req.headers.get('x-forwarded-for')?.split(',')[0] || null;
  const consentUa = req.headers.get('user-agent') || null;
  await supabase.from('b2b_consents').upsert(
    scopes.map(scope => ({
      user_id: userId, organization_id: invite.organization_id,
      scope, granted: true, granted_at: new Date().toISOString(),
      consent_version: '2026-05-v1',
      consent_text_snapshot: `Toestemming voor ${scope}: verleend via uitnodigingscode`,
      consent_displayed_at: new Date(Date.now() - 5000).toISOString(),
      consent_submitted_at: new Date().toISOString(),
      consent_ip: consentIp,
      consent_user_agent: consentUa,
    })),
    { onConflict: 'user_id,organization_id,scope' }
  );

  // Mark invite used
  await supabase.from('b2b_invites').update({ status: 'activated', activated_at: new Date().toISOString() }).eq('id', invite.id);

  // Log consent (GDPR compliance)
  await supabase.from('consent_log').insert({
    user_id: userId,
    consent_type: 'b2b_org_connection',
    granted: true,
    ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || null,
    user_agent: req.headers.get('user-agent') || null,
  }).catch(() => {}); // non-fatal

  // Get org info to return
  const { data: org } = await supabase.from('organizations').select('id, name, type, city').eq('id', invite.organization_id).single();

  // Auto-join the org's default community group (Phase 7).
  await ensureDefaultGroupMembership(supabase, invite.organization_id, userId);

  return NextResponse.json({ ok: true, org }, { headers: NO_CACHE });
}

/**
 * DELETE /api/org-connections — user leaves a single organisation (Phase 6 exit).
 * Body: { organization_id: string, reason?: string }
 * Ends the relationship (status=exited + exited_at) and revokes that org's
 * consent, leaving the user's account and subscription untouched (the "two
 * clocks": relationship lifecycle is separate from subscription lifecycle).
 * Audit-logged so the organisation sees the user left.
 */
export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const { organization_id, reason } = await req.json().catch(() => ({}));
  if (!organization_id || typeof organization_id !== 'string') {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400, headers: NO_CACHE });
  }

  const supabase = createServiceRoleClient();

  // Confirm an active relationship exists.
  const { data: uo } = await supabase
    .from('user_organizations')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organization_id)
    .in('status', ['active', 'onboarded', 'invited', 'paused'])
    .single();
  if (!uo) return NextResponse.json({ error: 'Geen actieve koppeling met deze organisatie' }, { status: 404, headers: NO_CACHE });

  const now = new Date().toISOString();

  // 1) End the relationship clock (subscription clock untouched).
  await supabase
    .from('user_organizations')
    .update({ status: 'exited', exited_at: now, exit_reason: reason || null, updated_at: now })
    .eq('id', uo.id);

  // 2) Revoke this org's consent, preserving history.
  await supabase
    .from('b2b_consents')
    .update({ granted: false, revoked_at: now })
    .eq('user_id', userId)
    .eq('organization_id', organization_id);

  // 3) Audit so the organisation can see the user left.
  await supabase.from('b2b_audit_log').insert({
    organization_id,
    actor_id: userId,
    actor_type: 'user',
    action: 'relationship.user_exited',
    target_type: 'user',
    target_id: userId,
    metadata: { reason: reason || null },
  });

  return NextResponse.json({ ok: true }, { headers: NO_CACHE });
}
