'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Globe, Shield, ChevronRight, ChevronLeft, Check, Loader2,
  Mail, Camera, AlertTriangle, TrendingUp, Users, Scale,
} from 'lucide-react';

type Step = 0 | 1 | 2 | 3 | 4;

interface OnboardingWizardProps {
  initialName: string;
  initialLanguage: 'nl' | 'en';
}

export default function OnboardingWizard({ initialName, initialLanguage }: OnboardingWizardProps) {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);

  // Split initial name into first/last if possible
  const nameParts = initialName.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [language, setLanguage] = useState<'nl' | 'en'>(initialLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNl = language === 'nl';
  const TOTAL_STEPS = 5;

  function handleLanguageSwitch(lang: 'nl' | 'en') {
    setLanguage(lang);
    document.cookie = `paywatch-locale=${lang};path=/;max-age=31536000;samesite=lax`;
  }

  async function handleComplete() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          language,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong');
        setSaving(false);
        return;
      }
      window.location.href = '/overzicht';
    } catch {
      setError('Connection error');
      setSaving(false);
    }
  }

  const nextStep = useCallback(() => {
    if (animating || step >= 4) return;
    setAnimating(true);
    setDirection('next');
    // Small delay for exit feel, then switch
    requestAnimationFrame(() => {
      setStep((step + 1) as Step);
      setTimeout(() => setAnimating(false), 400);
    });
  }, [step, animating]);

  const prevStep = useCallback(() => {
    if (animating || step <= 0) return;
    setAnimating(true);
    setDirection('prev');
    requestAnimationFrame(() => {
      setStep((step - 1) as Step);
      setTimeout(() => setAnimating(false), 400);
    });
  }, [step, animating]);

  const canProceed =
    step === 0 || step === 1 || step === 2 || step === 3 ||
    (step === 4 && firstName.trim().length > 0);

  return (
    <main className="flex min-h-dvh flex-col bg-pw-bg">
      {/* Scoped animations */}
      <style jsx global>{`
        @keyframes ob-slide-next {
          0% { opacity: 0; transform: translateX(60px) scale(0.97); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes ob-slide-prev {
          0% { opacity: 0; transform: translateX(-60px) scale(0.97); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes ob-icon-pop {
          0% { opacity: 0; transform: scale(0.3) rotate(-10deg); }
          60% { transform: scale(1.08) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes ob-fade-up {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes ob-card-stagger {
          0% { opacity: 0; transform: translateY(16px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ob-progress-fill {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        .ob-enter-next { animation: ob-slide-next 450ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ob-enter-prev { animation: ob-slide-prev 450ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ob-icon-enter { animation: ob-icon-pop 500ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ob-fade-enter { animation: ob-fade-up 400ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ob-card-enter { animation: ob-card-stagger 400ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>

      {/* Progress bar — continuous, not dots */}
      <div className="px-6 pt-8 pb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-medium text-pw-muted">
            {step + 1} / {TOTAL_STEPS}
          </p>
          <p className="text-[11px] font-medium text-pw-blue">
            {Math.round(((step + 1) / TOTAL_STEPS) * 100)}%
          </p>
        </div>
        <div className="h-1.5 w-full rounded-full bg-pw-border overflow-hidden">
          <div
            className="h-full rounded-full bg-pw-blue"
            style={{
              width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
              transition: 'width 500ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-4">
        <div className="w-full max-w-[340px]">
          <div
            key={step}
            className={direction === 'next' ? 'ob-enter-next' : 'ob-enter-prev'}
          >
            {step === 0 && <StepLanguage language={language} onSwitch={handleLanguageSwitch} />}
            {step === 1 && <StepDebtFacts isNl={isNl} />}
            {step === 2 && <StepCollectorBusiness isNl={isNl} />}
            {step === 3 && <StepMission isNl={isNl} />}
            {step === 4 && (
              <StepName
                firstName={firstName}
                setFirstName={setFirstName}
                lastName={lastName}
                setLastName={setLastName}
                t={t}
              />
            )}
          </div>
          {error && (
            <p className="mt-4 text-center text-[12px] text-pw-red ob-fade-enter">{error}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 pb-8">
        {step > 0 ? (
          <button
            onClick={prevStep}
            disabled={animating}
            className="btn-press flex items-center gap-1 rounded-button px-4 py-2.5 text-[13px] font-semibold text-pw-muted active:scale-[0.97] transition-transform disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            {isNl ? 'Terug' : 'Back'}
          </button>
        ) : (
          <div />
        )}
        {step < 4 ? (
          <button
            onClick={nextStep}
            disabled={!canProceed || animating}
            className="btn-press flex items-center gap-1 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50 active:scale-[0.97] transition-transform"
          >
            {isNl ? 'Volgende' : 'Next'}
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={saving || !firstName.trim()}
            className="btn-press flex items-center gap-2 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50 active:scale-[0.97] transition-transform"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Check className="h-4 w-4" strokeWidth={1.5} />
            )}
            {isNl ? 'Start met PayWatch' : 'Start with PayWatch'}
          </button>
        )}
      </div>
    </main>
  );
}

/* ─── Step 0: Language ─── */
function StepLanguage({
  language,
  onSwitch,
}: {
  language: 'nl' | 'en';
  onSwitch: (l: 'nl' | 'en') => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="ob-icon-enter mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue/10">
        <Globe className="h-8 w-8 text-pw-blue" strokeWidth={1.5} />
      </div>
      <h1 className="ob-fade-enter text-hero text-pw-navy">
        {language === 'nl' ? 'Kies je taal' : 'Choose your language'}
      </h1>
      <p className="ob-fade-enter mt-2 text-body text-pw-muted" style={{ animationDelay: '80ms' }}>
        {language === 'nl' ? 'Je kunt dit later wijzigen.' : 'You can change this later.'}
      </p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <LangBtn
          selected={language === 'nl'}
          flag="🇳🇱"
          label="Nederlands"
          desc="Alle teksten in het Nederlands"
          onClick={() => onSwitch('nl')}
          delay={120}
        />
        <LangBtn
          selected={language === 'en'}
          flag="🇬🇧"
          label="English"
          desc="All text in English"
          onClick={() => onSwitch('en')}
          delay={180}
        />
      </div>
    </div>
  );
}

function LangBtn({
  selected,
  flag,
  label,
  desc,
  onClick,
  delay,
}: {
  selected: boolean;
  flag: string;
  label: string;
  desc: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`ob-card-enter btn-press flex items-center gap-4 rounded-card border-2 px-4 py-3.5 text-left transition-all ${
        selected ? 'border-pw-blue bg-blue-50/50' : 'border-pw-border bg-pw-surface'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-[28px]">{flag}</span>
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-pw-text">{label}</p>
        <p className="text-[11px] text-pw-muted">{desc}</p>
      </div>
      {selected && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-pw-blue">
          <Check className="h-3 w-3 text-white" strokeWidth={2.5} />
        </div>
      )}
    </button>
  );
}

/* ─── Step 1: Debt Facts ─── */
function StepDebtFacts({ isNl }: { isNl: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="ob-icon-enter mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
        <AlertTriangle className="h-8 w-8 text-pw-red" strokeWidth={1.5} />
      </div>
      <h1 className="ob-fade-enter text-heading text-pw-navy">
        {isNl ? 'Schulden in Nederland' : 'Debt in the Netherlands'}
      </h1>
      <p className="ob-fade-enter mt-2 text-[13px] text-pw-muted" style={{ animationDelay: '80ms' }}>
        {isNl ? 'De cijfers liegen niet.' : 'The numbers speak for themselves.'}
      </p>
      <div className="mt-6 w-full space-y-3">
        <Fact
          value="1.6 million"
          label={isNl ? 'Nederlanders met betalingsachterstanden' : 'Dutch people with payment arrears'}
          color="text-pw-red"
          delay={120}
        />
        <Fact
          value="€43 billion"
          label={isNl ? 'Totale schuld bij incassobureaus' : 'Total debt held by collection agencies'}
          color="text-pw-red"
          delay={180}
        />
        <Fact
          value="730,000"
          label={isNl ? 'Huishoudens met ernstige schulden' : 'Households with serious debt problems'}
          color="text-pw-orange"
          delay={240}
        />
        <Fact
          value="3 in 10"
          label={isNl ? 'Jongeren (18-34) met moeite om rekeningen te betalen' : 'Young adults (18-34) struggling to pay bills'}
          color="text-pw-amber"
          delay={300}
        />
      </div>
      <p className="ob-fade-enter mt-4 text-[11px] text-pw-muted" style={{ animationDelay: '360ms' }}>
        {isNl ? 'Bron: Nibud, CBS, NVVK (2024)' : 'Source: Nibud, CBS, NVVK (2024)'}
      </p>
    </div>
  );
}

function Fact({
  value,
  label,
  color,
  delay,
}: {
  value: string;
  label: string;
  color: string;
  delay: number;
}) {
  return (
    <div
      className="ob-card-enter rounded-card border border-pw-border bg-pw-surface p-3 text-left"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className={`text-[20px] font-extrabold ${color}`}>{value}</p>
      <p className="text-[11px] text-pw-muted leading-snug">{label}</p>
    </div>
  );
}

/* ─── Step 2: Collector Business ─── */
function StepCollectorBusiness({ isNl }: { isNl: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="ob-icon-enter mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
        <TrendingUp className="h-8 w-8 text-amber-600" strokeWidth={1.5} />
      </div>
      <h1 className="ob-fade-enter text-heading text-pw-navy">
        {isNl ? 'Het verdienmodel' : 'The business model'}
      </h1>
      <p className="ob-fade-enter mt-2 text-[13px] text-pw-muted" style={{ animationDelay: '80ms' }}>
        {isNl
          ? 'Zo verdienen incassobureaus geld aan jouw vergeten rekening.'
          : 'How collection agencies make money from your forgotten bill.'}
      </p>
      <div className="mt-6 w-full space-y-3">
        <Stage stage={isNl ? 'Factuur' : 'Invoice'} extra="€0" desc={isNl ? 'Je originele rekening.' : 'Your original bill.'} color="text-pw-blue" delay={120} />
        <Stage stage={isNl ? 'Herinnering' : 'Reminder'} extra="+€15" desc={isNl ? 'Administratiekosten.' : 'Admin fees.'} color="text-pw-amber" delay={180} />
        <Stage stage={isNl ? 'Aanmaning' : 'Formal notice'} extra="+€40" desc={isNl ? 'WIK-kosten (wettelijk max 15%).' : 'WIK costs (legal max 15%).'} color="text-pw-orange" delay={240} />
        <Stage stage={isNl ? 'Incasso' : 'Collection'} extra="+€140" desc={isNl ? 'Bureau neemt 40% commissie.' : 'Agency takes 40% commission.'} color="text-pw-red" delay={300} />
        <Stage stage={isNl ? 'Deurwaarder' : 'Bailiff'} extra="+€300+" desc={isNl ? 'Proceskosten, beslag.' : 'Court costs, seizure.'} color="text-[#991B1B]" delay={360} />
      </div>
      <div
        className="ob-card-enter mt-4 rounded-card border-2 border-pw-red/20 bg-red-50/50 p-3"
        style={{ animationDelay: '420ms' }}
      >
        <p className="text-[12px] font-bold text-pw-red">
          {isNl ? 'Een rekening van €100 kan oplopen tot €500+' : 'A €100 bill can grow to €500+'}
        </p>
        <p className="text-[10px] text-pw-muted mt-1">
          {isNl ? 'Alleen door te laat betalen.' : 'Just from paying late.'}
        </p>
      </div>
    </div>
  );
}

function Stage({
  stage,
  extra,
  desc,
  color,
  delay,
}: {
  stage: string;
  extra: string;
  desc: string;
  color: string;
  delay: number;
}) {
  return (
    <div
      className="ob-card-enter flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface p-3 text-left"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex-1">
        <p className={`text-[13px] font-bold ${color}`}>{stage}</p>
        <p className="text-[10px] text-pw-muted">{desc}</p>
      </div>
      <p className={`text-[13px] font-bold ${color}`}>{extra}</p>
    </div>
  );
}

/* ─── Step 3: Mission ─── */
function StepMission({ isNl }: { isNl: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="ob-icon-enter mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue">
        <Shield className="h-8 w-8 text-white" strokeWidth={1.5} />
      </div>
      <h1 className="ob-fade-enter text-heading text-pw-navy">
        {isNl ? 'Wij houden de wacht' : 'We stand guard'}
      </h1>
      <p className="ob-fade-enter mt-2 text-[13px] text-pw-muted" style={{ animationDelay: '80ms' }}>
        {isNl
          ? 'Gebouwd door Samba en Mariama. Omdat het ons ook overkwam.'
          : 'Built by Samba and Mariama. Because it happened to us too.'}
      </p>
      <div className="mt-6 w-full space-y-3">
        <Feature icon={Mail} title={isNl ? 'Gmail scanner' : 'Gmail scanner'} desc={isNl ? 'AI herkent automatisch facturen in je inbox.' : 'AI automatically detects invoices in your inbox.'} delay={120} />
        <Feature icon={Camera} title={isNl ? 'Foto scanner' : 'Photo scanner'} desc={isNl ? 'Scan papieren rekeningen met je camera.' : 'Scan paper bills with your camera.'} delay={180} />
        <Feature icon={AlertTriangle} title={isNl ? 'Escalatie tracking' : 'Escalation tracking'} desc={isNl ? 'We volgen elke fase — van factuur tot deurwaarder.' : 'We track every stage — from invoice to bailiff.'} delay={240} />
        <Feature icon={Scale} title={isNl ? 'Juridische hulp' : 'Legal help'} desc={isNl ? 'Verbinding met advocaten en schuldhulp.' : 'Connected to lawyers and debt help.'} delay={300} />
        <Feature icon={Users} title={isNl ? 'Lokale hulp' : 'Local help'} desc={isNl ? 'Gekoppeld aan jouw gemeente.' : 'Linked to your municipality.'} delay={360} />
      </div>
      <div
        className="ob-card-enter mt-4 rounded-card bg-gradient-to-br from-blue-50 to-green-50 p-3"
        style={{ animationDelay: '420ms' }}
      >
        <p className="text-[12px] font-semibold text-pw-navy">
          {isNl ? 'Rust in je hoofd over elke rekening.' : 'Peace of mind for every bill.'}
        </p>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <div
      className="ob-card-enter flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface p-3 text-left"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-input bg-pw-blue/10">
        <Icon className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-pw-text">{title}</p>
        <p className="text-[10px] text-pw-muted">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Step 4: Name (First + Last) ─── */
function StepName({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  t,
}: {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="ob-fade-enter text-heading text-pw-navy">{t('welcomeTitle')}</h1>
      <p className="ob-fade-enter mt-2 text-body text-pw-muted" style={{ animationDelay: '80ms' }}>
        {t('welcomeSubtitle')}
      </p>
      <div className="ob-card-enter mt-8 w-full space-y-4" style={{ animationDelay: '120ms' }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="mb-1.5 block text-left text-label text-pw-text">
              {t('firstName')}
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t('firstName')}
              autoFocus
              className="w-full rounded-input border border-pw-border bg-pw-surface px-4 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue transition-shadow"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="mb-1.5 block text-left text-label text-pw-text">
              {t('lastName')}
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t('lastName')}
              className="w-full rounded-input border border-pw-border bg-pw-surface px-4 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue transition-shadow"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
