'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Globe, Shield, ChevronRight, ChevronLeft, Check, Loader2,
  Mail, Camera, Layers, AlertTriangle, TrendingUp, Users, Scale,
} from 'lucide-react';

type Step = 0 | 1 | 2 | 3 | 4 | 5;
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

  const TOTAL_STEPS = 6;

  async function handleLanguageSwitch(lang: 'nl' | 'en') {
    setLanguage(lang);
    // Set cookie immediately so translations update on next page load
    document.cookie = `paywatch-locale=${lang};path=/;max-age=31536000;samesite=lax`;
  }

  async function handleComplete() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim(), language, scan_preference: scanPref }),
      });
      if (!res.ok) { const data = await res.json(); setError(data.error || 'Something went wrong'); setSaving(false); return; }
      window.location.href = '/overzicht';
    } catch { setError('Connection error'); setSaving(false); }
  }

  function nextStep() { if (step < 5) setStep((step + 1) as Step); }
  function prevStep() { if (step > 0) setStep((step - 1) as Step); }

  const canProceed = step === 0 || step === 1 || step === 2 || step === 3 || (step === 4 && displayName.trim()) || step === 5;

  return (
    <main className="flex min-h-dvh flex-col bg-pw-bg">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-1.5 px-6 pt-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-pw-blue' : i < step ? 'w-1.5 bg-pw-blue/40' : 'w-1.5 bg-pw-border'}`} />
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6">
        <div className="w-full max-w-[340px]">
          {step === 0 && <StepLanguage language={language} onSwitch={handleLanguageSwitch} />}
          {step === 1 && <StepDebtFacts />}
          {step === 2 && <StepCollectorBusiness />}
          {step === 3 && <StepPayWatchMission />}
          {step === 4 && <StepName displayName={displayName} setDisplayName={setDisplayName} t={t} />}
          {step === 5 && <StepScanPref scanPref={scanPref} setScanPref={setScanPref} t={t} />}
          {error && <p className="mt-4 text-center text-[12px] text-pw-red">{error}</p>}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 pb-8">
        {step > 0 ? (
          <button onClick={prevStep} className="btn-press flex items-center gap-1 rounded-button px-4 py-2.5 text-[13px] font-semibold text-pw-muted">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            {language === 'nl' ? 'Terug' : 'Back'}
          </button>
        ) : <div />}

        {step < 5 ? (
          <button onClick={nextStep} disabled={!canProceed}
            className="btn-press flex items-center gap-1 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
            {language === 'nl' ? 'Volgende' : 'Next'}
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ) : (
          <button onClick={handleComplete} disabled={saving || !displayName.trim()}
            className="btn-press flex items-center gap-2 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Check className="h-4 w-4" strokeWidth={1.5} />}
            {language === 'nl' ? 'Start met PayWatch' : 'Start with PayWatch'}
          </button>
        )}
      </div>
    </main>
  );
}

/* ============================================================
   STEP 0: Language (FIRST — so user understands everything)
   ============================================================ */
function StepLanguage({ language, onSwitch }: { language: 'nl' | 'en'; onSwitch: (l: 'nl' | 'en') => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue/10">
        <Globe className="h-8 w-8 text-pw-blue" strokeWidth={1.5} />
      </div>
      <h1 className="text-hero text-pw-navy">{language === 'nl' ? 'Kies je taal' : 'Choose your language'}</h1>
      <p className="mt-2 text-body text-pw-muted">{language === 'nl' ? 'Je kunt dit later wijzigen in de instellingen.' : 'You can change this later in settings.'}</p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <LangOption selected={language === 'nl'} flag="🇳🇱" label="Nederlands" desc="Alle teksten in het Nederlands" onClick={() => onSwitch('nl')} />
        <LangOption selected={language === 'en'} flag="🇬🇧" label="English" desc="All text in English" onClick={() => onSwitch('en')} />
      </div>
    </div>
  );
}

function LangOption({ selected, flag, label, desc, onClick }: { selected: boolean; flag: string; label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`btn-press flex items-center gap-4 rounded-card border-2 px-4 py-3.5 text-left transition-all ${selected ? 'border-pw-blue bg-blue-50/50' : 'border-pw-border bg-pw-surface hover:border-pw-muted/50'}`}>
      <span className="text-[28px]">{flag}</span>
      <div className="flex-1"><p className="text-[14px] font-semibold text-pw-text">{label}</p><p className="text-[11px] text-pw-muted">{desc}</p></div>
      {selected && <div className="flex h-5 w-5 items-center justify-center rounded-full bg-pw-blue"><Check className="h-3 w-3 text-white" strokeWidth={2.5} /></div>}
    </button>
  );
}

/* ============================================================
   STEP 1: Debt facts in the Netherlands
   ============================================================ */
function StepDebtFacts() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
        <AlertTriangle className="h-8 w-8 text-pw-red" strokeWidth={1.5} />
      </div>
      <h1 className="text-heading text-pw-navy">Schulden in Nederland</h1>
      <p className="mt-2 text-[13px] text-pw-muted leading-relaxed">De cijfers liegen niet.</p>

      <div className="mt-6 w-full space-y-3">
        <FactCard value="1,6 miljoen" label="Nederlanders met betalingsachterstanden" color="text-pw-red" />
        <FactCard value="€43 miljard" label="Totale schuld bij incassobureaus" color="text-pw-red" />
        <FactCard value="730.000" label="Huishoudens met ernstige schulden" color="text-pw-orange" />
        <FactCard value="3 van de 10" label="Jongeren (18-34) die moeite hebben met rekeningen" color="text-pw-amber" />
      </div>

      <p className="mt-4 text-[11px] text-pw-muted">Bron: Nibud, CBS, NVVK (2024)</p>
    </div>
  );
}

function FactCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-3 text-left">
      <p className={`text-[20px] font-extrabold ${color}`}>{value}</p>
      <p className="text-[11px] text-pw-muted leading-snug">{label}</p>
    </div>
  );
}

/* ============================================================
   STEP 2: How debt collectors make money
   ============================================================ */
function StepCollectorBusiness() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
        <TrendingUp className="h-8 w-8 text-amber-600" strokeWidth={1.5} />
      </div>
      <h1 className="text-heading text-pw-navy">Het verdienmodel</h1>
      <p className="mt-2 text-[13px] text-pw-muted leading-relaxed">Zo verdienen incassobureaus geld aan jouw vergeten rekening.</p>

      <div className="mt-6 w-full space-y-3">
        <StageCard stage="Factuur" amount="€100,00" extra="€0" desc="Je originele rekening." color="text-pw-blue" />
        <StageCard stage="Herinnering" amount="€100,00" extra="+€15" desc="Administratiekosten." color="text-pw-amber" />
        <StageCard stage="Aanmaning" amount="€100,00" extra="+€40" desc="WIK-kosten (wettelijk maximum 15%)." color="text-pw-orange" />
        <StageCard stage="Incasso" amount="€100,00" extra="+€140" desc="Bureau neemt 40% commissie." color="text-pw-red" />
        <StageCard stage="Deurwaarder" amount="€100,00" extra="+€300+" desc="Proceskosten, betekening, beslag." color="text-[#991B1B]" />
      </div>

      <div className="mt-4 rounded-card border-2 border-pw-red/20 bg-red-50/50 p-3">
        <p className="text-[12px] font-bold text-pw-red">Een rekening van €100 kan oplopen tot €500+</p>
        <p className="text-[10px] text-pw-muted mt-1">Alleen door het te laat betalen.</p>
      </div>
    </div>
  );
}

function StageCard({ stage, amount, extra, desc, color }: { stage: string; amount: string; extra: string; desc: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface p-3 text-left">
      <div className="flex-1">
        <p className={`text-[13px] font-bold ${color}`}>{stage}</p>
        <p className="text-[10px] text-pw-muted">{desc}</p>
      </div>
      <div className="text-right">
        <p className="text-[11px] text-pw-muted">{amount}</p>
        <p className={`text-[13px] font-bold ${color}`}>{extra}</p>
      </div>
    </div>
  );
}

/* ============================================================
   STEP 3: PayWatch mission
   ============================================================ */
function StepPayWatchMission() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue">
        <Shield className="h-8 w-8 text-white" strokeWidth={1.5} />
      </div>
      <h1 className="text-heading text-pw-navy">Wij houden de wacht</h1>
      <p className="mt-2 text-[13px] text-pw-muted leading-relaxed">PayWatch is gebouwd door Samba en Mariama. Omdat het ons ook overkwam.</p>

      <div className="mt-6 w-full space-y-3">
        <MissionCard icon={Mail} title="Gmail scanner" desc="AI herkent automatisch facturen in je inbox." />
        <MissionCard icon={Camera} title="Foto scanner" desc="Scan papieren rekeningen met je camera." />
        <MissionCard icon={AlertTriangle} title="Escalatie tracking" desc="We volgen elke fase — van factuur tot deurwaarder." />
        <MissionCard icon={Scale} title="Juridische hulp" desc="Directe verbinding met advocaten en schuldhulp." />
        <MissionCard icon={Users} title="Lokale hulp" desc="Gekoppeld aan jouw gemeente voor schuldhulpverlening." />
      </div>

      <div className="mt-4 rounded-card bg-gradient-to-br from-blue-50 to-green-50 p-3">
        <p className="text-[12px] font-semibold text-pw-navy">Rust in je hoofd over elke rekening.</p>
      </div>
    </div>
  );
}

function MissionCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface p-3 text-left">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-input bg-pw-blue/10">
        <Icon className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
      </div>
      <div><p className="text-[13px] font-semibold text-pw-text">{title}</p><p className="text-[10px] text-pw-muted">{desc}</p></div>
    </div>
  );
}

/* ============================================================
   STEP 4: Your name
   ============================================================ */
function StepName({ displayName, setDisplayName, t }: { displayName: string; setDisplayName: (v: string) => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-heading text-pw-navy">{t('welcomeTitle')}</h1>
      <p className="mt-2 text-body text-pw-muted">{t('welcomeSubtitle')}</p>
      <div className="mt-8 w-full">
        <label htmlFor="name" className="mb-1.5 block text-left text-label text-pw-text">{t('yourName')}</label>
        <input id="name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('namePlaceholder')}
          className="w-full rounded-input border border-pw-border bg-pw-surface px-4 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
      </div>
    </div>
  );
}

/* ============================================================
   STEP 5: Scan preference
   ============================================================ */
function StepScanPref({ scanPref, setScanPref, t }: { scanPref: ScanPref; setScanPref: (v: ScanPref) => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-heading text-pw-navy">{t('scanTitle')}</h1>
      <p className="mt-2 text-body text-pw-muted">{t('scanSubtitle')}</p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <ScanOpt selected={scanPref === 'gmail'} icon={Mail} label={t('scanGmail')} desc={t('scanGmailDesc')} onClick={() => setScanPref('gmail')} />
        <ScanOpt selected={scanPref === 'camera'} icon={Camera} label={t('scanCamera')} desc={t('scanCameraDesc')} onClick={() => setScanPref('camera')} />
        <ScanOpt selected={scanPref === 'both'} icon={Layers} label={t('scanBoth')} desc={t('scanBothDesc')} onClick={() => setScanPref('both')} />
      </div>
    </div>
  );
}

function ScanOpt({ selected, icon: Icon, label, desc, onClick }: { selected: boolean; icon: React.ElementType; label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`btn-press flex items-center gap-4 rounded-card border-2 px-4 py-3.5 text-left transition-all ${selected ? 'border-pw-blue bg-blue-50/50' : 'border-pw-border bg-pw-surface hover:border-pw-muted/50'}`}>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-input ${selected ? 'bg-pw-blue/10' : 'bg-pw-bg'}`}>
        <Icon className={`h-5 w-5 ${selected ? 'text-pw-blue' : 'text-pw-muted'}`} strokeWidth={1.5} />
      </div>
      <div className="flex-1"><p className="text-[14px] font-semibold text-pw-text">{label}</p><p className="text-[11px] text-pw-muted">{desc}</p></div>
      {selected && <div className="flex h-5 w-5 items-center justify-center rounded-full bg-pw-blue"><Check className="h-3 w-3 text-white" strokeWidth={2.5} /></div>}
    </button>
  );
}
