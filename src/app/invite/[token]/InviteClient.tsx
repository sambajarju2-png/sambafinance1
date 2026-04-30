"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  token: string;
  inviteId: string;
  orgName: string;
  orgColor: string;
  orgLogo: string | null;
  introText: string | null;
  prefillEmail: string;
  isAlreadyActivated: boolean;
}

export default function InviteClient({
  token, inviteId, orgName, orgColor, orgLogo, introText, prefillEmail, isAlreadyActivated,
}: Props) {
  const router = useRouter();
  // Default to login — most invitees will either have an account or should confirm email
  const [mode, setMode] = useState<"signup" | "login">("login");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);

  if (isAlreadyActivated) {
    return (
      <Shell orgName={orgName} orgColor={orgColor} orgLogo={orgLogo}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Al geactiveerd</h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 16px" }}>Deze uitnodiging is al gebruikt.</p>
          <a href="/auth/login" style={{ display: "inline-block", padding: "10px 20px", background: orgColor, color: "#FFFFFF", borderRadius: 4, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            Inloggen
          </a>
        </div>
      </Shell>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "signup") {
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { invite_token: token },
            // After email confirmation, redirect back here so page.tsx auto-activates invite
            emailRedirectTo: `${window.location.origin}/invite/${token}`,
          },
        });

        if (signupError) {
          if (
            signupError.message.toLowerCase().includes("already registered") ||
            signupError.message.toLowerCase().includes("user already registered")
          ) {
            // Switch to login silently
            setMode("login");
            setError("Dit e-mailadres heeft al een account. Log hieronder in.");
            setLoading(false);
            return;
          }
          setError(signupError.message);
          setLoading(false);
          return;
        }

        if (!data.session) {
          // Email confirmation required — show success screen, don't show error
          setEmailConfirmationSent(true);
          setLoading(false);
          return;
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) {
          setError("Onjuist e-mailadres of wachtwoord.");
          setLoading(false);
          return;
        }
      }

      // Activate invite via API
      const res = await fetch("/api/invite/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const result = await res.json();
      if (result.error) {
        console.error("Activate error:", result.error);
      }

      // Redirect to onboarding or dashboard
      router.push("/onboarding");
    } catch (err: any) {
      setError(err.message || "Er ging iets mis");
    }
    setLoading(false);
  }

  // Show email confirmation screen after successful signup
  if (emailConfirmationSent) {
    return (
      <Shell orgName={orgName} orgColor={orgColor} orgLogo={orgLogo}>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Bevestig je e-mail</h2>
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>
            We hebben een bevestigingsmail gestuurd naar <strong>{email}</strong>.
            Klik op de link in de mail om je account te activeren en verder te gaan.
          </p>
          <p style={{ fontSize: 12, color: "#94A3B8" }}>
            Geen mail ontvangen? Controleer ook je spammap.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell orgName={orgName} orgColor={orgColor} orgLogo={orgLogo}>
      {introText && (
        <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>{introText}</p>
      )}

      {!introText && (
        <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>
          {orgName} heeft je uitgenodigd om PayWatch te gebruiken. Met PayWatch houd je overzicht over je rekeningen en betalingen.
        </p>
      )}

      {/* Toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 8, overflow: "hidden", border: "1px solid #E2E8F0" }}>
        <button
          type="button"
          onClick={() => setMode("signup")}
          style={{
            flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
            background: mode === "signup" ? orgColor : "#F8FAFC",
            color: mode === "signup" ? "#FFFFFF" : "#64748B",
          }}
        >
          Nieuw account
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          style={{
            flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
            background: mode === "login" ? orgColor : "#F8FAFC",
            color: mode === "login" ? "#FFFFFF" : "#64748B",
          }}
        >
          Al een account
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748B", marginBottom: 4 }}>E-mailadres</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required autoFocus={!prefillEmail}
            placeholder="je@email.com"
            style={{
              width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 8,
              fontSize: 14, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748B", marginBottom: 4 }}>
            {mode === "signup" ? "Kies een wachtwoord" : "Wachtwoord"}
          </label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            required autoFocus={!!prefillEmail}
            placeholder={mode === "signup" ? "Minimaal 6 tekens" : "Je wachtwoord"}
            minLength={6}
            style={{
              width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 8,
              fontSize: 14, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {error && (
          <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "12px", background: orgColor, color: "#FFFFFF", border: "none",
            borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Even geduld..." : mode === "signup" ? "Account aanmaken" : "Inloggen en koppelen"}
        </button>
      </form>

      <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 16 }}>
        Door je aan te melden ga je akkoord met de voorwaarden van PayWatch.
      </p>
    </Shell>
  );
}

function Shell({ orgName, orgColor, orgLogo, children }: {
  orgName: string; orgColor: string; orgLogo: string | null; children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F7FB", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Branded header */}
        <div style={{ background: orgColor, borderRadius: "12px 12px 0 0", padding: "20px 24px", display: "flex", alignItems: "center", gap: 10 }}>
          {orgLogo && <img src={orgLogo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain", background: "rgba(255,255,255,0.15)" }} />}
          <span style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700 }}>{orgName}</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 500 }}>via PayWatch</span>
        </div>

        {/* Content */}
        <div style={{ background: "#FFFFFF", borderRadius: "0 0 12px 12px", padding: 24, border: "1px solid #E2E8F0", borderTop: "none" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Je bent uitgenodigd</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
