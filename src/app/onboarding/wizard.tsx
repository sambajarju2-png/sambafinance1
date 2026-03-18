'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import {
  Shield,
  Globe,
  Mail,
  Camera,
  Layers,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
} from 'lucide-react';

type Step = 0 | 1 | 2 | 3;
type ScanPref = 'gmail' | 'camera' | 'both';

interface OnboardingWizardProps {
  initialName: string;
  initialLanguage: 'nl' | 'en';
}

export default function OnboardingWizard({ initialName, initialLanguage }: OnboardingWizardProps) {
  const t = useTranslations('onboarding');
  const router = useRouter();

  const [step, setStep] = useState<Step>(0);
  const [displayName, setDisplayName] = useState(initialName);
  const [language, setLanguage] = useState<'nl' | 'en'>(initialLanguage);
  const [scanPref, setScanPref] = useState<ScanPref>('both');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const TOTAL_STEPS = 4;

  async function handleComplete() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          language,
          scan_preference: scanPref,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong');
        setSaving(false);
        return;
      }

      // Force a full page reload to pick up new locale cookie + settings
      window.location.href = '/';
    } catch {
      setError('Connection error');
      setSaving(false);
    }
  }

  function nextStep() {
    if (step < 3) {
      setStep((step + 1) as Step);
    }
  }

  function prevStep() {
    if (step > 0) {
      setStep((step - 1) as Step);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      {/* Stepper dots */}
      <div className="flex items-center justify-center gap-2 px-6 pt-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === step
                ? 'w-6 bg-pw-blue'
                : i < step
                ? 'w-2 bg-pw-blue/40'
                : 'w-2 bg-pw-border'
            }`}
          />
        ))}
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-[320px]">
          {step === 0 && (
            <StepWelcome
              t={t}
              displayName={displayName}
              setDisplayName={setDisplayName}
            />
          )}

          {step === 1 && (
            <StepLanguage
              t={t}
              language={language}
              setLanguage={setLanguage}
            />
          )}

          {step === 2 && (
            <StepScanPreference
              t={t}
              scanPref={scanPref}
              setScanPref={setScanPref}
            />
          )}

          {step === 3 && (
            <StepReady t={t} scanPref={scanPref} />
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 text-center text-label text-pw-red">{error}</p>
          )}
        </div>
      </div>

      {/* Bottom navigation buttons */}
      <div className="flex items-center justify-between px-6 pb-8">
        {/* Back button */}
        {step > 0 ? (
          <button
            onClick={prevStep}
            className="btn-press flex items-center gap-1 rounded-button px-4 py-2.5 text-[13px] font-semibold text-pw-muted transition-colors hover:text-pw-text"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            {t('back')}
          </button>
        ) : (
          <div />
        )}

        {/* Next / Complete button */}
        {step < 3 ? (
          <button
            onClick={nextStep}
            disabled={step === 0 && !displayName.trim()}
            className="btn-press flex items-center gap-1 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={saving}
            className="btn-press flex items-center gap-2 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Check className="h-4 w-4" strokeWidth={1.5} />
            )}
            {t('startUsing')}
          </button>
        )}
      </div>
    </main>
  );
}

/* ============================================================
   STEP 0: Welcome + Name
   ============================================================ */
function StepWelcome({
  t,
  displayName,
  setDisplayName,
}: {
  t: ReturnType<typeof useTranslations>;
  displayName: string;
  setDisplayName: (v: string) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue">
        <Shield className="h-8 w-8 text-white" strokeWidth={1.5} />
      </div>

      <h1 className="text-hero text-pw-navy">{t('welcomeTitle')}</h1>
      <p className="mt-2 text-body text-pw-muted">{t('welcomeSubtitle')}</p>

      <div className="mt-8 w-full">
        <label htmlFor="name" className="mb-1.5 block text-left text-label text-pw-text">
          {t('yourName')}
        </label>
        <input
          id="name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('namePlaceholder')}
          className="w-full rounded-input border border-pw-border bg-white px-4 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
        />
      </div>
    </div>
  );
}

/* ============================================================
   STEP 1: Language Selection
   ============================================================ */
function StepLanguage({
  t,
  language,
  setLanguage,
}: {
  t: ReturnType<typeof useTranslations>;
  language: 'nl' | 'en';
  setLanguage: (v: 'nl' | 'en') => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue/10">
        <Globe className="h-8 w-8 text-pw-blue" strokeWidth={1.5} />
      </div>

      <h1 className="text-heading text-pw-navy">{t('languageTitle')}</h1>
      <p className="mt-2 text-body text-pw-muted">{t('languageSubtitle')}</p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <LanguageOption
          selected={language === 'nl'}
          flag="🇳🇱"
          label="Nederlands"
          description="Alle teksten in het Nederlands"
          onClick={() => setLanguage('nl')}
        />
        <LanguageOption
          selected={language === 'en'}
          flag="🇬🇧"
          label="English"
          description="All text in English"
          onClick={() => setLanguage('en')}
        />
      </div>
    </div>
  );
}

function LanguageOption({
  selected,
  flag,
  label,
  description,
  onClick,
}: {
  selected: boolean;
  flag: string;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn-press flex items-center gap-4 rounded-card border-2 px-4 py-3.5 text-left transition-all ${
        selected
          ? 'border-pw-blue bg-blue-50/50'
          : 'border-pw-border bg-white hover:border-pw-muted/50'
      }`}
    >
      <span className="text-[28px]">{flag}</span>
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-pw-text">{label}</p>
        <p className="text-[11px] text-pw-muted">{description}</p>
      </div>
      {selected && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-pw-blue">
          <Check className="h-3 w-3 text-white" strokeWidth={2.5} />
        </div>
      )}
    </button>
  );
}

/* ============================================================
   STEP 2: Scan Preference
   ============================================================ */
function StepScanPreference({
  t,
  scanPref,
  setScanPref,
}: {
  t: ReturnType<typeof useTranslations>;
  scanPref: ScanPref;
  setScanPref: (v: ScanPref) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-heading text-pw-navy">{t('scanTitle')}</h1>
      <p className="mt-2 text-body text-pw-muted">{t('scanSubtitle')}</p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <ScanOption
          selected={scanPref === 'gmail'}
          icon={Mail}
          label={t('scanGmail')}
          description={t('scanGmailDesc')}
          onClick={() => setScanPref('gmail')}
        />
        <ScanOption
          selected={scanPref === 'camera'}
          icon={Camera}
          label={t('scanCamera')}
          description={t('scanCameraDesc')}
          onClick={() => setScanPref('camera')}
        />
        <ScanOption
          selected={scanPref === 'both'}
          icon={Layers}
          label={t('scanBoth')}
          description={t('scanBothDesc')}
          onClick={() => setScanPref('both')}
        />
      </div>
    </div>
  );
}

function ScanOption({
  selected,
  icon: Icon,
  label,
  description,
  onClick,
}: {
  selected: boolean;
  icon: React.ComponentType<Record<string, unknown>>;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn-press flex items-center gap-4 rounded-card border-2 px-4 py-3.5 text-left transition-all ${
        selected
          ? 'border-pw-blue bg-blue-50/50'
          : 'border-pw-border bg-white hover:border-pw-muted/50'
      }`}
    >
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-input ${
          selected ? 'bg-pw-blue/10' : 'bg-pw-bg'
        }`}
      >
        <Icon
          className={`h-5 w-5 ${selected ? 'text-pw-blue' : 'text-pw-muted'}`}
          strokeWidth={1.5}
        />
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-pw-text">{label}</p>
        <p className="text-[11px] text-pw-muted">{description}</p>
      </div>
      {selected && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-pw-blue">
          <Check className="h-3 w-3 text-white" strokeWidth={2.5} />
        </div>
      )}
    </button>
  );
}

/* ============================================================
   STEP 3: Ready to go
   ============================================================ */
function StepReady({
  t,
  scanPref,
}: {
  t: ReturnType<typeof useTranslations>;
  scanPref: ScanPref;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-green/10">
        <Check className="h-8 w-8 text-pw-green" strokeWidth={1.5} />
      </div>

      <h1 className="text-heading text-pw-navy">{t('readyTitle')}</h1>
      <p className="mt-2 text-body text-pw-muted">{t('readySubtitle')}</p>

      {/* Summary of choices */}
      <div className="mt-8 w-full space-y-2">
        <SummaryRow
          label={t('readyScanMethod')}
          value={
            scanPref === 'gmail'
              ? t('scanGmail')
              : scanPref === 'camera'
              ? t('scanCamera')
              : t('scanBoth')
          }
        />
      </div>

      <p className="mt-6 text-[12px] text-pw-muted">
        {scanPref === 'gmail' || scanPref === 'both'
          ? t('readyGmailHint')
          : t('readyCameraHint')}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-input border border-pw-border bg-pw-bg px-4 py-2.5">
      <span className="text-[12px] font-medium text-pw-muted">{label}</span>
      <span className="text-[13px] font-semibold text-pw-text">{value}</span>
    </div>
  );
}
