'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect, useMemo } from 'react';
import {
  Shield, ChevronLeft, Users, Home, Heart, Gift,
  Copy, Check, AlertTriangle, Info, FileText,
} from 'lucide-react';
import { formatCents } from '@/lib/bills';
import { calculateBeslagvrijeVoet, generateBvvCorrectionLetter, type BvvInput } from '@/lib/beslagvrije-voet';
import { useRouter } from 'next/navigation';

type HuishoudType = 'alleenstaand' | 'alleenstaand_ouder' | 'samenwonend';

const HUISHOUD_OPTIONS: { value: HuishoudType; labelKey: string; icon: typeof Users }[] = [
  { value: 'alleenstaand', labelKey: 'single', icon: Users },
  { value: 'samenwonend', labelKey: 'cohabiting', icon: Users },
  { value: 'alleenstaand_ouder', labelKey: 'singleParent', icon: Users },
];

function CentsField({
  label, value, onChange, placeholder, icon,
}: {
  label: string; value: number; onChange: (v: number) => void;
  placeholder?: string; icon: React.ReactNode;
}) {
  const [display, setDisplay] = useState(value > 0 ? (value / 100).toString() : '');
  useEffect(() => { setDisplay(value > 0 ? (value / 100).toString() : ''); }, [value]);

  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-pw-muted">{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pw-muted">{icon}</div>
        <input
          type="number" inputMode="decimal" placeholder={placeholder}
          className="w-full rounded-xl border border-pw-border bg-pw-surface py-2.5 pl-10 pr-10 text-[15px] font-medium text-pw-text outline-none focus:border-pw-blue focus:ring-1 focus:ring-pw-blue/20"
          value={display}
          onChange={(e) => {
            setDisplay(e.target.value);
            const euros = parseFloat(e.target.value);
            onChange(isNaN(euros) ? 0 : Math.round(euros * 100));
          }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-pw-muted">€/mnd</span>
      </div>
    </div>
  );
}

export default function BeslagvrijeVoetPage() {
  const t = useTranslations("beslagvrijeVoet");
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [deurwaarderNaam, setDeurwaarderNaam] = useState('');
  const [userName, setUserName] = useState('');

  // Form state
  const [huishoudType, setHuishoudType] = useState<HuishoudType>('alleenstaand');
  const [huur, setHuur] = useState(0);
  const [zorgpremie, setZorgpremie] = useState(0);
  const [toeslagen, setToeslagen] = useState(0);
  const [nettoloon, setNettoloon] = useState(0);

  // Auto-load financial data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/finances');
        if (!res.ok) return;
        const data = await res.json();
        if (data) {
          const totalIncome = (data.netto_inkomen || 0) + (data.partner_inkomen || 0) +
            (data.duo_inkomen || 0) + (data.uitkering_inkomen || 0) +
            (data.toeslagen_inkomen || 0) + (data.overig_inkomen || 0);
          if (totalIncome > 0) setNettoloon(totalIncome);
          if (data.monthly_rent > 0) setHuur(data.monthly_rent);
          if (data.has_partner) setHuishoudType('samenwonend');
          if (data.toeslagen_actueel) {
            const totaalToeslagen = Object.values(data.toeslagen_actueel as Record<string, number>)
              .reduce((sum, v) => sum + (v || 0), 0);
            if (totaalToeslagen > 0) setToeslagen(totaalToeslagen);
          }
        }
      } catch {}

      // Load user name
      try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) {
          const profile = await res.json();
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
          if (name) setUserName(name);
        }
      } catch {}
    }
    load();
  }, []);

  const input: BvvInput = useMemo(() => ({
    huishoudType, huurCents: huur, zorgpremieCents: zorgpremie,
    toeslagenCents: toeslagen, nettoloonCents: nettoloon,
  }), [huishoudType, huur, zorgpremie, toeslagen, nettoloon]);

  const result = useMemo(() => calculateBeslagvrijeVoet(input), [input]);

  const hasInput = nettoloon > 0;

  const letter = useMemo(() => {
    if (!hasInput) return '';
    return generateBvvCorrectionLetter(result, userName || '[Uw naam]', deurwaarderNaam || '[Naam deurwaarder]');
  }, [result, userName, deurwaarderNaam, hasInput]);

  async function handleCopyLetter() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-pw-surface border border-pw-border/60">
          <ChevronLeft className="h-4 w-4 text-pw-muted" />
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-pw-text">Beslagvrije voet</h1>
          <p className="text-[12px] text-pw-muted">Bereken het minimumbedrag dat je mag houden</p>
        </div>
      </div>

      {/* Explanation */}
      <div className="flex gap-3 rounded-xl border border-pw-blue/20 bg-pw-blue/[0.04] p-3.5">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-blue" />
        <p className="text-[12px] leading-relaxed text-pw-text/80">
          Als een deurwaarder beslag legt op je inkomen, moet er altijd een minimumbedrag overblijven
          om van te leven. Dit heet de <strong>beslagvrije voet</strong>. Als er te veel wordt ingehouden,
          kun je een correctie aanvragen.
        </p>
      </div>

      {/* Household type */}
      <div className="space-y-2">
        <label className="text-[12px] font-medium text-pw-muted">Jouw situatie</label>
        <div className="grid grid-cols-1 gap-2">
          {HUISHOUD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setHuishoudType(opt.value)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                huishoudType === opt.value
                  ? 'border-pw-blue bg-pw-blue/[0.06]'
                  : 'border-pw-border/60 bg-pw-surface'
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                huishoudType === opt.value ? 'bg-pw-blue/15' : 'bg-pw-bg'
              }`}>
                <opt.icon className={`h-4 w-4 ${huishoudType === opt.value ? 'text-pw-blue' : 'text-pw-muted'}`} />
              </div>
              <span className={`text-[14px] font-medium ${huishoudType === opt.value ? 'text-pw-blue' : 'text-pw-text'}`}>
                {t(opt.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Input fields */}
      <div className="space-y-3 rounded-2xl border border-pw-border/60 bg-pw-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <CentsField
          label={t("netIncome")}
          value={nettoloon}
          onChange={setNettoloon}
          placeholder="bijv. 2200"
          icon={<Gift className="h-4 w-4" />}
        />
        <CentsField
          label={t("bareRent")}
          value={huur}
          onChange={setHuur}
          placeholder="bijv. 750"
          icon={<Home className="h-4 w-4" />}
        />
        <CentsField
          label={t("healthInsurance")}
          value={zorgpremie}
          onChange={setZorgpremie}
          placeholder="bijv. 140"
          icon={<Heart className="h-4 w-4" />}
        />
        <CentsField
          label={t("totalBenefits")}
          value={toeslagen}
          onChange={setToeslagen}
          placeholder="bijv. 200"
          icon={<Gift className="h-4 w-4" />}
        />
      </div>

      {/* Result */}
      {hasInput && (
        <>
          <div className={`rounded-2xl border p-5 ${
            result.isOnderBvv
              ? 'border-pw-red/30 bg-pw-red/[0.04]'
              : 'border-pw-green/30 bg-pw-green/[0.04]'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-pw-muted">Jouw beslagvrije voet</p>
                <p className={`mt-0.5 text-[28px] font-extrabold leading-none tracking-[-0.03em] ${
                  result.isOnderBvv ? 'text-pw-red' : 'text-pw-green'
                }`}>
                  {formatCents(result.beslagvrijeVoet)}
                </p>
                <p className="mt-1 text-[11px] text-pw-muted">per maand</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                result.isOnderBvv ? 'bg-pw-red/10' : 'bg-pw-green/10'
              }`}>
                <Shield className={`h-5 w-5 ${result.isOnderBvv ? 'text-pw-red' : 'text-pw-green'}`} />
              </div>
            </div>

            {/* Breakdown */}
            <div className="mt-4 space-y-1.5 border-t border-pw-border/30 pt-3">
              <div className="flex justify-between text-[12px]">
                <span className="text-pw-muted">90% bijstandsnorm</span>
                <span className="font-medium text-pw-text">{formatCents(result.basisBvv)}</span>
              </div>
              {result.woonCorrectie > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-pw-muted">+ Woonkostencorrectie</span>
                  <span className="font-medium text-pw-text">+{formatCents(result.woonCorrectie)}</span>
                </div>
              )}
              {result.zorgCorrectie > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-pw-muted">+ Zorgpremiecorrectie</span>
                  <span className="font-medium text-pw-text">+{formatCents(result.zorgCorrectie)}</span>
                </div>
              )}
              {result.toeslagenAftrek > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-pw-muted">- Ontvangen toeslagen</span>
                  <span className="font-medium text-pw-red">-{formatCents(result.toeslagenAftrek)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-pw-border/20 pt-1.5 text-[13px]">
                <span className="font-medium text-pw-text">Maximaal beslag</span>
                <span className="font-bold text-pw-text">{formatCents(result.maxBeslag)}</span>
              </div>
            </div>
          </div>

          {/* Warning if under BVV */}
          {result.isOnderBvv && (
            <div className="flex gap-3 rounded-xl border border-pw-red/20 bg-pw-red/[0.05] p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" />
              <div>
                <p className="text-[13px] font-semibold text-pw-red">Je inkomen ligt onder de beslagvrije voet</p>
                <p className="mt-1 text-[12px] text-pw-text/70">
                  Er mag geen beslag worden gelegd op je inkomen. Neem direct contact op met de
                  deurwaarder of vraag hulp bij je gemeente (schuldhulpverlening).
                </p>
              </div>
            </div>
          )}

          {/* Generate correction letter */}
          <div className="rounded-2xl border border-pw-border/60 bg-pw-surface p-4">
            <button
              onClick={() => setShowLetter(!showLetter)}
              className="flex w-full items-center gap-3 text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pw-blue/10">
                <FileText className="h-4 w-4 text-pw-blue" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-pw-text">Correctiebrief genereren</p>
                <p className="text-[11px] text-pw-muted">Stuur naar je deurwaarder als er te veel wordt ingehouden</p>
              </div>
            </button>

            {showLetter && (
              <div className="mt-4 space-y-3 border-t border-pw-border/40 pt-4">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-pw-muted">Jouw naam</label>
                  <input
                    type="text" value={userName} onChange={e => setUserName(e.target.value)}
                    placeholder={t("enterName")}
                    className="w-full rounded-xl border border-pw-border bg-pw-bg px-3 py-2 text-[14px] outline-none focus:border-pw-blue"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-pw-muted">Naam deurwaarder / incassobureau</label>
                  <input
                    type="text" value={deurwaarderNaam} onChange={e => setDeurwaarderNaam(e.target.value)}
                    placeholder="bijv. GGN Mastering Credit"
                    className="w-full rounded-xl border border-pw-border bg-pw-bg px-3 py-2 text-[14px] outline-none focus:border-pw-blue"
                  />
                </div>

                <div className="rounded-lg bg-pw-bg p-3">
                  <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-pw-text/80 font-sans">{letter}</pre>
                </div>

                <button
                  onClick={handleCopyLetter}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-pw-blue py-2.5 text-[14px] font-semibold text-white"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('copied') : t('copyLetter')}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Disclaimer */}
      <p className="text-center text-[10px] text-pw-muted/60">
        Geschat op basis van VTLB-parameters 2026. Raadpleeg een schuldhulpverlener of het Juridisch Loket
        voor een exacte berekening.
      </p>
    </div>
  );
}
