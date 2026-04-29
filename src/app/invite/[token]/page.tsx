import { createServiceRoleClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import InviteClient from "./InviteClient";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = createServiceRoleClient();

  // Look up invite
  const { data: invite, error } = await supabase
    .from("b2b_invites")
    .select("id, token, email, external_id, organization_id, status, expires_at, organizations(name, primary_color, secondary_color, logo_url, slug, custom_intro_text)")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F7FB", padding: 20 }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Ongeldige uitnodiging</h1>
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>Deze uitnodigingslink is ongeldig of niet meer beschikbaar. Neem contact op met je hulpverlener voor een nieuwe link.</p>
        </div>
      </div>
    );
  }

  const org = (invite as any).organizations;
  const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
  const isUsed = invite.status === "activated";

  if (isExpired) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F7FB", padding: 20 }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Uitnodiging verlopen</h1>
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>Deze uitnodiging is helaas verlopen. Vraag je hulpverlener om een nieuwe link te sturen.</p>
        </div>
      </div>
    );
  }

  // If user is already logged in, activate directly
  const userId = await getAuthUserId();
  if (userId && !isUsed) {
    // Link user to org and redirect
    await supabase.from("user_organizations").upsert({
      user_id: userId,
      organization_id: invite.organization_id,
      status: "active",
      external_id: invite.external_id,
      onboarded_at: new Date().toISOString(),
    }, { onConflict: "user_id,organization_id" });

    await supabase.from("b2b_invites")
      .update({ status: "activated", activated_at: new Date().toISOString() })
      .eq("id", invite.id);

    redirect("/overzicht");
  }

  // Mark as opened
  if (invite.status === "pending") {
    await supabase.from("b2b_invites")
      .update({ status: "opened" })
      .eq("id", invite.id);
  }

  return (
    <InviteClient
      token={token}
      inviteId={invite.id}
      orgName={org?.name || "Partner"}
      orgColor={org?.primary_color || "#2563EB"}
      orgLogo={org?.logo_url || null}
      introText={org?.custom_intro_text || null}
      prefillEmail={invite.email || ""}
      isAlreadyActivated={isUsed}
    />
  );
}
