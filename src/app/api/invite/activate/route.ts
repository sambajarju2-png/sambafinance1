import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 });

  // Get current user
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Admin client for privileged operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Look up invite
  const { data: invite, error: inviteError } = await supabase
    .from("b2b_invites")
    .select("id, organization_id, external_id, status, expires_at")
    .or(`token.eq.${token},short_code.eq.${token.toUpperCase()}`)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.status === "activated") {
    return NextResponse.json({ error: "Already activated", already_active: true });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  // Link user to organization
  const { error: linkError } = await supabase.from("user_organizations").upsert(
    {
      user_id: user.id,
      organization_id: invite.organization_id,
      status: "active",
      external_id: invite.external_id,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: "user_id,organization_id" }
  );

  if (linkError) {
    console.error("[Invite] Link error:", linkError);
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  // Accepting the invite grants ONLY the minimum required scope (contact_info), so
  // the org can reach the user. Any access to bills, finances, payment plans or
  // messaging must be granted explicitly by the user via the granular consent UI.
  // Privacy-first: no blanket full_access auto-grant.
  const consentIp = request.headers.get("x-forwarded-for")?.split(",")[0] || null;
  const consentUa = request.headers.get("user-agent") || null;
  const consentNow = new Date().toISOString();
  await supabase.from("b2b_consents").upsert(
    [{
      user_id: user.id,
      organization_id: invite.organization_id,
      scope: "contact_info",
      granted: true,
      granted_at: consentNow,
      consent_version: "2026-06-v2",
      consent_text_snapshot: "Toestemming voor contact_info: verleend via uitnodiging (minimale toegang). Verdere toegang wordt apart en expliciet gegeven.",
      consent_displayed_at: consentNow,
      consent_submitted_at: consentNow,
      consent_ip: consentIp,
      consent_user_agent: consentUa,
    }],
    { onConflict: "user_id,organization_id,scope" }
  );

  // Mark invite as activated
  await supabase.from("b2b_invites").update({
    status: "activated",
    activated_at: new Date().toISOString(),
  }).eq("id", invite.id);

  // Update member status in B2B portal (so it shows "Actief" instead of "Uitgenodigd")
  await supabase.from("b2b_org_members").update({
    invite_status: "accepted",
  }).eq("organization_id", invite.organization_id).eq("email", user.email);

  // Log in audit
  await supabase.from("b2b_audit_log").insert({
    organization_id: invite.organization_id,
    actor_id: null,
    actor_type: "system",
    action: "invite.activated",
    target_type: "invite",
    target_id: invite.id,
    metadata: { user_id: user.id, user_email: user.email },
  }).then(() => {});

  return NextResponse.json({ success: true, organization_id: invite.organization_id });
}
