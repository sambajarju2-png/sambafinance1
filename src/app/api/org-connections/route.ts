import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

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
  const validScopes = ['contact_info', 'view_bills', 'financial_overview', 'payment_plans', 'messaging', 'full_access', 'aggregated'];
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

  return NextResponse.json({ ok: true, org }, { headers: NO_CACHE });
}
