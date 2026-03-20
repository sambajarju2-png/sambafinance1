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
  const isNl = language === 'nl';
  const TOTAL_STEPS = 6;

  async function handleLanguageSwitch(lang: 'nl' | 'en') {
    setLanguage(lang);
    document.cookie = `paywatch-locale=${lang};path=/;max-age=31536000;samesite=lax`;
  }

  async function handleComplete() {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      <div className="flex items-center justify-center gap-1.5 px-6 pt-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-pw-blue' : i < step ? 'w-1.5 bg-pw-blue/40' : 'w-1.5 bg-pw-border'}`} />
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6">
        <div className="w-full max-w-[340px]">
          {step === 0 && <StepLanguage language={language} onSwitch={handleLanguageSwitch} />}
          {step === 1 && <StepDebtFacts isNl={isNl} />}
          {step === 2 && <StepCollectorBusiness isNl={isNl} />}
          {step === 3 && <StepMission isNl={isNl} />}
          {step === 4 && <StepName displayName={displayName} setDisplayName={setDisplayName} t={t} />}
          {step === 5 && <StepScanPref scanPref={scanPref} setScanPref={setScanPref} t={t} />}
          {error && <p className="mt-4 text-center text-[12px] text-pw-red">{error}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between px-6 pb-8">
        {step > 0 ? (
          <button onClick={prevStep} className="btn-press flex items-center gap-1 rounded-button px-4 py-2.5 text-[13px] font-semibold text-pw-muted">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> {isNl ? 'Terug' : 'Back'}
          </button>
        ) : <div />}
        {step < 5 ? (
          <button onClick={nextStep} disabled={!canProceed}
            className="btn-press flex items-center gap-1 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
            {isNl ? 'Volgende' : 'Next'} <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ) : (
          <button onClick={handleComplete} disabled={saving || !displayName.trim()}
            className="btn-press flex items-center gap-2 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Check className="h-4 w-4" strokeWidth={1.5} />}
            {isNl ? 'Start met PayWatch' : 'Start with PayWatch'}
          </button>
        )}
      </div>
    </main>
  );
}

function StepLanguage({ language, onSwitch }: { language: 'nl' | 'en'; onSwitch: (l: 'nl' | 'en') => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue/10"><Globe className="h-8 w-8 text-pw-blue" strokeWidth={1.5} /></div>
      <h1 className="text-hero text-pw-navy">{language === 'nl' ? 'Kies je taal' : 'Choose your language'}</h1>
      <p className="mt-2 text-body text-pw-muted">{language === 'nl' ? 'Je kunt dit later wijzigen.' : 'You can change this later.'}</p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <LangBtn selected={language === 'nl'} flag="🇳🇱" label="Nederlands" desc="Alle teksten in het Nederlands" onClick={() => onSwitch('nl')} />
        <LangBtn selected={language === 'en'} flag="🇬🇧" label="English" desc="All text in English" onClick={() => onSwitch('en')} />
      </div>
    </div>
  );
}

function LangBtn({ selected, flag, label, desc, onClick }: { selected: boolean; flag: string; label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`btn-press flex items-center gap-4 rounded-card border-2 px-4 py-3.5 text-left transition-all ${selected ? 'border-pw-blue bg-blue-50/50' : 'border-pw-border bg-pw-surface'}`}>
      <span className="text-[28px]">{flag}</span>
      <div className="flex-1"><p className="text-[14px] font-semibold text-pw-text">{label}</p><p className="text-[11px] text-pw-muted">{desc}</p></div>
      {selected && <div className="flex h-5 w-5 items-center justify-center rounded-full bg-pw-blue"><Check className="h-3 w-3 text-white" strokeWidth={2.5} /></div>}
    </button>
  );
}

function StepDebtFacts({ isNl }: { isNl: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50"><AlertTriangle className="h-8 w-8 text-pw-red" strokeWidth={1.5} /></div>
      <h1 className="text-heading text-pw-navy">{isNl ? 'Schulden in Nederland' : 'Debt in the Netherlands'}</h1>
      <p className="mt-2 text-[13px] text-pw-muted">{isNl ? 'De cijfers liegen niet.' : 'The numbers speak for themselves.'}</p>
      <div className="mt-6 w-full space-y-3">
        <Fact value="1.6 million" label={isNl ? 'Nederlanders met betalingsachterstanden' : 'Dutch people with payment arrears'} color="text-pw-red" />
        <Fact value="€43 billion" label={isNl ? 'Totale schuld bij incassobureaus' : 'Total debt held by collection agencies'} color="text-pw-red" />
        <Fact value="730,000" label={isNl ? 'Huishoudens met ernstige schulden' : 'Households with serious debt problems'} color="text-pw-orange" />
        <Fact value="3 in 10" label={isNl ? 'Jongeren (18-34) met moeite om rekeningen te betalen' : 'Young adults (18-34) struggling to pay bills'} color="text-pw-amber" />
      </div>
      <p className="mt-4 text-[11px] text-pw-muted">{isNl ? 'Bron: Nibud, CBS, NVVK (2024)' : 'Source: Nibud, CBS, NVVK (2024)'}</p>
    </div>
  );
}

function Fact({ value, label, color }: { value: string; label: string; color: string }) {
  return (<div className="rounded-card border border-pw-border bg-pw-surface p-3 text-left"><p className={`text-[20px] font-extrabold ${color}`}>{value}</p><p className="text-[11px] text-pw-muted leading-snug">{label}</p></div>);
}

function StepCollectorBusiness({ isNl }: { isNl: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50"><TrendingUp className="h-8 w-8 text-amber-600" strokeWidth={1.5} /></div>
      <h1 className="text-heading text-pw-navy">{isNl ? 'Het verdienmodel' : 'The business model'}</h1>
      <p className="mt-2 text-[13px] text-pw-muted">{isNl ? 'Zo verdienen incassobureaus geld aan jouw vergeten rekening.' : 'How collection agencies make money from your forgotten bill.'}</p>
      <div className="mt-6 w-full space-y-3">
        <Stage stage={isNl ? 'Factuur' : 'Invoice'} extra="€0" desc={isNl ? 'Je originele rekening.' : 'Your original bill.'} color="text-pw-blue" />
        <Stage stage={isNl ? 'Herinnering' : 'Reminder'} extra="+€15" desc={isNl ? 'Administratiekosten.' : 'Admin fees.'} color="text-pw-amber" />
        <Stage stage={isNl ? 'Aanmaning' : 'Formal notice'} extra="+€40" desc={isNl ? 'WIK-kosten (wettelijk max 15%).' : 'WIK costs (legal max 15%).'} color="text-pw-orange" />
        <Stage stage={isNl ? 'Incasso' : 'Collection'} extra="+€140" desc={isNl ? 'Bureau neemt 40% commissie.' : 'Agency takes 40% commission.'} color="text-pw-red" />
        <Stage stage={isNl ? 'Deurwaarder' : 'Bailiff'} extra="+€300+" desc={isNl ? 'Proceskosten, beslag.' : 'Court costs, seizure.'} color="text-[#991B1B]" />
      </div>
      <div className="mt-4 rounded-card border-2 border-pw-red/20 bg-red-50/50 p-3">
        <p className="text-[12px] font-bold text-pw-red">{isNl ? 'Een rekening van €100 kan oplopen tot €500+' : 'A €100 bill can grow to €500+'}</p>
        <p className="text-[10px] text-pw-muted mt-1">{isNl ? 'Alleen door te laat betalen.' : 'Just from paying late.'}</p>
      </div>
    </div>
  );
}

function Stage({ stage, extra, desc, color }: { stage: string; extra: string; desc: string; color: string }) {
  return (<div className="flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface p-3 text-left"><div className="flex-1"><p className={`text-[13px] font-bold ${color}`}>{stage}</p><p className="text-[10px] text-pw-muted">{desc}</p></div><p className={`text-[13px] font-bold ${color}`}>{extra}</p></div>);
}

function StepMission({ isNl }: { isNl: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue"><Shield className="h-8 w-8 text-white" strokeWidth={1.5} /></div>
      <h1 className="text-heading text-pw-navy">{isNl ? 'Wij houden de wacht' : 'We stand guard'}</h1>
      <p className="mt-2 text-[13px] text-pw-muted">{isNl ? 'Gebouwd door Samba en Mariama. Omdat het ons ook overkwam.' : 'Built by Samba and Mariama. Because it happened to us too.'}</p>
      <div className="mt-6 w-full space-y-3">
        <Feature icon={Mail} title={isNl ? 'Gmail scanner' : 'Gmail scanner'} desc={isNl ? 'AI herkent automatisch facturen in je inbox.' : 'AI automatically detects invoices in your inbox.'} />
        <Feature icon={Camera} title={isNl ? 'Foto scanner' : 'Photo scanner'} desc={isNl ? 'Scan papieren rekeningen met je camera.' : 'Scan paper bills with your camera.'} />
        <Feature icon={AlertTriangle} title={isNl ? 'Escalatie tracking' : 'Escalation tracking'} desc={isNl ? 'We volgen elke fase — van factuur tot deurwaarder.' : 'We track every stage — from invoice to bailiff.'} />
        <Feature icon={Scale} title={isNl ? 'Juridische hulp' : 'Legal help'} desc={isNl ? 'Verbinding met advocaten en schuldhulp.' : 'Connected to lawyers and debt help.'} />
        <Feature icon={Users} title={isNl ? 'Lokale hulp' : 'Local help'} desc={isNl ? 'Gekoppeld aan jouw gemeente.' : 'Linked to your municipality.'} />
      </div>
      <div className="mt-4 rounded-card bg-gradient-to-br from-blue-50 to-green-50 p-3">
        <p className="text-[12px] font-semibold text-pw-navy">{isNl ? 'Rust in je hoofd over elke rekening.' : 'Peace of mind for every bill.'}</p>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (<div className="flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface p-3 text-left"><div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-input bg-pw-blue/10"><Icon className="h-4 w-4 text-pw-blue" strokeWidth={1.5} /></div><div><p className="text-[13px] font-semibold text-pw-text">{title}</p><p className="text-[10px] text-pw-muted">{desc}</p></div></div>);
}

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
    <button onClick={onClick} className={`btn-press flex items-center gap-4 rounded-card border-2 px-4 py-3.5 text-left transition-all ${selected ? 'border-pw-blue bg-blue-50/50' : 'border-pw-border bg-pw-surface'}`}>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-input ${selected ? 'bg-pw-blue/10' : 'bg-pw-bg'}`}>
        <Icon className={`h-5 w-5 ${selected ? 'text-pw-blue' : 'text-pw-muted'}`} strokeWidth={1.5} />
      </div>
      <div className="flex-1"><p className="text-[14px] font-semibold text-pw-text">{label}</p><p className="text-[11px] text-pw-muted">{desc}</p></div>
      {selected && <div className="flex h-5 w-5 items-center justify-center rounded-full bg-pw-blue"><Check className="h-3 w-3 text-white" strokeWidth={2.5} /></div>}
    </button>
  );
}
