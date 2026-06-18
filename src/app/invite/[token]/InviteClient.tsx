"use client";

import { useState, useEffect } from "react";
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
  inviteLang: string;
}

// The user was invited in this language: the page renders in it and we set the
// paywatch-locale cookie so signup + onboarding continue in the same language.
const SUPPORTED = ["nl", "en", "pl", "tr", "fr", "ar"];

const T: Record<string, {
  title: string;
  activatedTitle: string;
  activatedBody: string;
  login: string;
  intro: (org: string) => string;
  newAccount: string;
  haveAccount: string;
  emailLabel: string;
  pwLabelSignup: string;
  pwLabelLogin: string;
  pwPhSignup: string;
  pwPhLogin: string;
  submitSignup: string;
  submitLogin: string;
  loading: string;
  terms: string;
  errExists: string;
  errLogin: string;
  errGeneric: string;
  confirmTitle: string;
  confirmL: string;
  confirmR: string;
  confirmSpam: string;
}> = {
  nl: {
    title: "Je bent uitgenodigd",
    activatedTitle: "Al geactiveerd",
    activatedBody: "Deze uitnodiging is al gebruikt.",
    login: "Inloggen",
    intro: (org) => `${org} heeft je uitgenodigd om PayWatch te gebruiken. Met PayWatch houd je overzicht over je rekeningen en betalingen.`,
    newAccount: "Nieuw account",
    haveAccount: "Al een account",
    emailLabel: "E-mailadres",
    pwLabelSignup: "Kies een wachtwoord",
    pwLabelLogin: "Wachtwoord",
    pwPhSignup: "Minimaal 6 tekens",
    pwPhLogin: "Je wachtwoord",
    submitSignup: "Account aanmaken",
    submitLogin: "Inloggen en koppelen",
    loading: "Even geduld...",
    terms: "Door je aan te melden ga je akkoord met de voorwaarden van PayWatch.",
    errExists: "Dit e-mailadres heeft al een account. Log hieronder in.",
    errLogin: "Onjuist e-mailadres of wachtwoord.",
    errGeneric: "Er ging iets mis",
    confirmTitle: "Bevestig je e-mail",
    confirmL: "We hebben een bevestigingsmail gestuurd naar ",
    confirmR: ". Klik op de link in de mail om je account te activeren en verder te gaan.",
    confirmSpam: "Geen mail ontvangen? Controleer ook je spammap.",
  },
  en: {
    title: "You've been invited",
    activatedTitle: "Already activated",
    activatedBody: "This invitation has already been used.",
    login: "Log in",
    intro: (org) => `${org} has invited you to use PayWatch. With PayWatch you keep track of your bills and payments.`,
    newAccount: "New account",
    haveAccount: "I have an account",
    emailLabel: "Email address",
    pwLabelSignup: "Choose a password",
    pwLabelLogin: "Password",
    pwPhSignup: "At least 6 characters",
    pwPhLogin: "Your password",
    submitSignup: "Create account",
    submitLogin: "Log in and connect",
    loading: "Please wait...",
    terms: "By signing up you agree to the PayWatch terms.",
    errExists: "This email already has an account. Log in below.",
    errLogin: "Incorrect email or password.",
    errGeneric: "Something went wrong",
    confirmTitle: "Confirm your email",
    confirmL: "We've sent a confirmation email to ",
    confirmR: ". Click the link in the email to activate your account and continue.",
    confirmSpam: "Didn't get the email? Check your spam folder too.",
  },
  pl: {
    title: "Masz zaproszenie",
    activatedTitle: "Już aktywowane",
    activatedBody: "To zaproszenie zostało już wykorzystane.",
    login: "Zaloguj się",
    intro: (org) => `${org} zaprasza Cię do korzystania z PayWatch. Dzięki PayWatch masz pełen przegląd swoich rachunków i płatności.`,
    newAccount: "Nowe konto",
    haveAccount: "Mam już konto",
    emailLabel: "Adres e-mail",
    pwLabelSignup: "Wybierz hasło",
    pwLabelLogin: "Hasło",
    pwPhSignup: "Minimum 6 znaków",
    pwPhLogin: "Twoje hasło",
    submitSignup: "Załóż konto",
    submitLogin: "Zaloguj i połącz",
    loading: "Chwila cierpliwości...",
    terms: "Rejestrując się, akceptujesz warunki PayWatch.",
    errExists: "Ten adres e-mail ma już konto. Zaloguj się poniżej.",
    errLogin: "Nieprawidłowy e-mail lub hasło.",
    errGeneric: "Coś poszło nie tak",
    confirmTitle: "Potwierdź swój e-mail",
    confirmL: "Wysłaliśmy e-mail z potwierdzeniem na adres ",
    confirmR: ". Kliknij link w e-mailu, aby aktywować konto i kontynuować.",
    confirmSpam: "Nie dotarł e-mail? Sprawdź też folder ze spamem.",
  },
  tr: {
    title: "Davet edildin",
    activatedTitle: "Zaten etkinleştirildi",
    activatedBody: "Bu davet zaten kullanıldı.",
    login: "Giriş yap",
    intro: (org) => `${org} seni PayWatch'i kullanmaya davet etti. PayWatch ile faturalarını ve ödemelerini kolayca takip edersin.`,
    newAccount: "Yeni hesap",
    haveAccount: "Zaten hesabım var",
    emailLabel: "E-posta adresi",
    pwLabelSignup: "Bir şifre seç",
    pwLabelLogin: "Şifre",
    pwPhSignup: "En az 6 karakter",
    pwPhLogin: "Şifren",
    submitSignup: "Hesap oluştur",
    submitLogin: "Giriş yap ve bağlan",
    loading: "Lütfen bekle...",
    terms: "Kaydolarak PayWatch koşullarını kabul edersin.",
    errExists: "Bu e-posta adresinin zaten bir hesabı var. Aşağıdan giriş yap.",
    errLogin: "E-posta veya şifre hatalı.",
    errGeneric: "Bir şeyler ters gitti",
    confirmTitle: "E-postanı onayla",
    confirmL: "Onay e-postasını şu adrese gönderdik: ",
    confirmR: ". Hesabını etkinleştirip devam etmek için e-postadaki bağlantıya tıkla.",
    confirmSpam: "E-posta gelmedi mi? Spam klasörünü de kontrol et.",
  },
  fr: {
    title: "Vous êtes invité",
    activatedTitle: "Déjà activé",
    activatedBody: "Cette invitation a déjà été utilisée.",
    login: "Se connecter",
    intro: (org) => `${org} vous a invité à utiliser PayWatch. Avec PayWatch, vous gardez une vue d'ensemble de vos factures et de vos paiements.`,
    newAccount: "Nouveau compte",
    haveAccount: "J'ai déjà un compte",
    emailLabel: "Adresse e-mail",
    pwLabelSignup: "Choisissez un mot de passe",
    pwLabelLogin: "Mot de passe",
    pwPhSignup: "Au moins 6 caractères",
    pwPhLogin: "Votre mot de passe",
    submitSignup: "Créer un compte",
    submitLogin: "Se connecter et lier",
    loading: "Un instant...",
    terms: "En vous inscrivant, vous acceptez les conditions de PayWatch.",
    errExists: "Cette adresse e-mail a déjà un compte. Connectez-vous ci-dessous.",
    errLogin: "Adresse e-mail ou mot de passe incorrect.",
    errGeneric: "Une erreur s'est produite",
    confirmTitle: "Confirmez votre e-mail",
    confirmL: "Nous avons envoyé un e-mail de confirmation à ",
    confirmR: ". Cliquez sur le lien dans l'e-mail pour activer votre compte et continuer.",
    confirmSpam: "Pas d'e-mail reçu ? Vérifiez aussi votre dossier spam.",
  },
  ar: {
    title: "لقد تمت دعوتك",
    activatedTitle: "مُفعّل بالفعل",
    activatedBody: "تم استخدام هذه الدعوة بالفعل.",
    login: "تسجيل الدخول",
    intro: (org) => `دعاك ${org} لاستخدام PayWatch. مع PayWatch تحافظ على نظرة شاملة لفواتيرك ومدفوعاتك.`,
    newAccount: "حساب جديد",
    haveAccount: "لديّ حساب بالفعل",
    emailLabel: "البريد الإلكتروني",
    pwLabelSignup: "اختر كلمة مرور",
    pwLabelLogin: "كلمة المرور",
    pwPhSignup: "6 أحرف على الأقل",
    pwPhLogin: "كلمة المرور الخاصة بك",
    submitSignup: "إنشاء حساب",
    submitLogin: "تسجيل الدخول والربط",
    loading: "لحظة من فضلك...",
    terms: "بالتسجيل فإنك توافق على شروط PayWatch.",
    errExists: "هذا البريد الإلكتروني لديه حساب بالفعل. سجّل الدخول أدناه.",
    errLogin: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    errGeneric: "حدث خطأ ما",
    confirmTitle: "أكّد بريدك الإلكتروني",
    confirmL: "أرسلنا رسالة تأكيد إلى ",
    confirmR: ". اضغط على الرابط في الرسالة لتفعيل حسابك والمتابعة.",
    confirmSpam: "لم تصلك رسالة؟ تحقق أيضًا من مجلد الرسائل غير المرغوب فيها.",
  },
};

export default function InviteClient({
  token, inviteId, orgName, orgColor, orgLogo, introText, prefillEmail, isAlreadyActivated, inviteLang,
}: Props) {
  const router = useRouter();
  const lang = SUPPORTED.includes(inviteLang) ? inviteLang : "nl";
  const t = T[lang];

  // Carry the invite language forward: set the locale cookie so the app + the
  // onboarding wizard start in the same language the user was invited in.
  useEffect(() => {
    document.cookie = `paywatch-locale=${lang};path=/;max-age=31536000;samesite=lax`;
  }, [lang]);

  // Default to login — most invitees will either have an account or should confirm email
  const [mode, setMode] = useState<"signup" | "login">("login");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);

  if (isAlreadyActivated) {
    return (
      <Shell orgName={orgName} orgColor={orgColor} orgLogo={orgLogo} title={t.title} dir={lang === "ar" ? "rtl" : "ltr"}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>{t.activatedTitle}</h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 16px" }}>{t.activatedBody}</p>
          <a href="/auth/login" style={{ display: "inline-block", padding: "10px 20px", background: orgColor, color: "#FFFFFF", borderRadius: 4, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            {t.login}
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
            setError(t.errExists);
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
          setError(t.errLogin);
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
      setError(err.message || t.errGeneric);
    }
    setLoading(false);
  }

  // Show email confirmation screen after successful signup
  if (emailConfirmationSent) {
    return (
      <Shell orgName={orgName} orgColor={orgColor} orgLogo={orgLogo} title={t.title} dir={lang === "ar" ? "rtl" : "ltr"}>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>{t.confirmTitle}</h2>
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>
            {t.confirmL}<strong>{email}</strong>{t.confirmR}
          </p>
          <p style={{ fontSize: 12, color: "#94A3B8" }}>
            {t.confirmSpam}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell orgName={orgName} orgColor={orgColor} orgLogo={orgLogo} title={t.title} dir={lang === "ar" ? "rtl" : "ltr"}>
      {introText && (
        <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>{introText}</p>
      )}

      {!introText && (
        <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>
          {t.intro(orgName)}
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
          {t.newAccount}
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
          {t.haveAccount}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748B", marginBottom: 4 }}>{t.emailLabel}</label>
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
            {mode === "signup" ? t.pwLabelSignup : t.pwLabelLogin}
          </label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            required autoFocus={!!prefillEmail}
            placeholder={mode === "signup" ? t.pwPhSignup : t.pwPhLogin}
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
          {loading ? t.loading : mode === "signup" ? t.submitSignup : t.submitLogin}
        </button>
      </form>

      <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 16 }}>
        {t.terms}
      </p>
    </Shell>
  );
}

function Shell({ orgName, orgColor, orgLogo, title, dir = "ltr", children }: {
  orgName: string; orgColor: string; orgLogo: string | null; title: string; dir?: "ltr" | "rtl"; children: React.ReactNode;
}) {
  return (
    <div dir={dir} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F7FB", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Branded header */}
        <div style={{ background: orgColor, borderRadius: "12px 12px 0 0", padding: "20px 24px", display: "flex", alignItems: "center", gap: 10 }}>
          {orgLogo && <img src={orgLogo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain", background: "rgba(255,255,255,0.15)" }} />}
          <span style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700 }}>{orgName}</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 500 }}>via PayWatch</span>
        </div>

        {/* Content */}
        <div style={{ background: "#FFFFFF", borderRadius: "0 0 12px 12px", padding: 24, border: "1px solid #E2E8F0", borderTop: "none" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
