'use client';

import { useState } from 'react';
import { X, Loader2, ShieldCheck, Ban, Megaphone, Heart, ChevronRight, ArrowLeft } from 'lucide-react';

interface CommunityNamePickerProps {
  onComplete: (name: string) => void;
  onClose: () => void;
}

type Step = 'name' | 'rules';

export default function CommunityNamePicker({ onComplete, onClose }: CommunityNamePickerProps) {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [acceptedRules, setAcceptedRules] = useState(false);

  const avatarUrl = name.trim()
    ? `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(name.trim())}`
    : `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=default`;

  function handleNextStep() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Minimaal 2 tekens');
      return;
    }
    setError('');
    setStep('rules');
  }

  async function handleSave() {
    if (!acceptedRules) {
      setError('Je moet de huisregels accepteren');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/community/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Er ging iets mis');
        return;
      }

      onComplete(name.trim());
    } catch {
      setError('Er ging iets mis');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="drawer-backdrop fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="drawer-spring fixed bottom-0 left-0 right-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-pw-border" /></div>

        <div className="px-5 pb-8 pt-4">
          {/* ── STEP 1: Choose Name ── */}
          {step === 'name' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[18px] font-bold text-pw-navy">Welkom bij de community!</h2>
                <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pw-blue text-[11px] font-bold text-white">1</div>
                <div className="h-[2px] flex-1 bg-pw-border" />
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pw-border text-[11px] font-bold text-pw-muted">2</div>
              </div>

              {/* Avatar preview */}
              <div className="flex flex-col items-center mb-6">
                <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-pw-border bg-pw-surface">
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full" />
                </div>
                <p className="mt-2 text-[12px] text-pw-muted">Je avatar wordt gegenereerd op basis van je naam</p>
              </div>

              {/* Name input */}
              <div className="mb-6">
                <label className="mb-1.5 block text-[12px] font-medium text-pw-text">
                  Kies je community naam
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value.slice(0, 30)); setError(''); }}
                  placeholder="Bijv. FinanceHero, SpaarKoning..."
                  className="w-full rounded-input border border-pw-border bg-pw-surface px-3.5 py-2.5 text-[14px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNextStep(); }}
                />
                <p className="mt-1 text-[11px] text-pw-muted">
                  Dit kan anders zijn dan je echte naam. Anoniem posten is altijd mogelijk.
                </p>
              </div>

              {error && <p className="mb-3 text-[11px] text-pw-red">{error}</p>}

              <button
                onClick={handleNextStep}
                disabled={!name.trim()}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                Volgende
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </>
          )}

          {/* ── STEP 2: House Rules ── */}
          {step === 'rules' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setStep('name'); setError(''); }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
                    <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                  <h2 className="text-[18px] font-bold text-pw-navy">Huisregels</h2>
                </div>
                <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pw-green text-[11px] font-bold text-white">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="h-[2px] flex-1 bg-pw-blue" />
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pw-blue text-[11px] font-bold text-white">2</div>
              </div>

              {/* Chosen name confirmation */}
              <div className="flex items-center gap-3 mb-6 rounded-card border border-pw-green/20 bg-green-50/50 dark:bg-pw-green/5 px-4 py-3">
                <div className="h-10 w-10 overflow-hidden rounded-full border border-pw-border bg-pw-surface flex-shrink-0">
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-pw-navy">{name.trim()}</p>
                  <p className="text-[11px] text-pw-green">Je community naam</p>
                </div>
              </div>

              {/* Rules intro */}
              <p className="text-[13px] text-pw-muted mb-4 leading-relaxed">
                Om een veilige en respectvolle omgeving te creëren, vragen we je om de volgende regels na te leven:
              </p>

              {/* House rules */}
              <div className="mb-5 space-y-3">
                <div className="flex items-start gap-3 rounded-card border border-pw-border bg-pw-surface p-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pw-blue/10 flex-shrink-0">
                    <Heart className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-pw-navy">Respect & steun</p>
                    <p className="text-[11px] text-pw-muted leading-relaxed mt-0.5">Wees respectvol en ondersteunend naar andere leden. Iedereen zit in een andere situatie.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-card border border-pw-border bg-pw-surface p-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pw-red/10 flex-shrink-0">
                    <Ban className="h-4 w-4 text-pw-red" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-pw-navy">Geen discriminatie</p>
                    <p className="text-[11px] text-pw-muted leading-relaxed mt-0.5">Geen discriminatie, beledigingen, haatspraak of pestgedrag. Nul tolerantie.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-card border border-pw-border bg-pw-surface p-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pw-amber/10 flex-shrink-0">
                    <Megaphone className="h-4 w-4 text-pw-amber" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-pw-navy">Geen spam of reclame</p>
                    <p className="text-[11px] text-pw-muted leading-relaxed mt-0.5">Geen reclame, spam of promotie van producten of diensten.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-card border border-pw-border bg-pw-surface p-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pw-green/10 flex-shrink-0">
                    <ShieldCheck className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-pw-navy">Privacy respecteren</p>
                    <p className="text-[11px] text-pw-muted leading-relaxed mt-0.5">Deel geen persoonlijke financiële gegevens van anderen. Wat hier gedeeld wordt, blijft hier.</p>
                  </div>
                </div>
              </div>

              {/* Accept checkbox */}
              <button
                onClick={() => { setAcceptedRules(!acceptedRules); setError(''); }}
                className={`mb-4 flex w-full items-center gap-3 rounded-card border-2 px-4 py-3.5 text-left transition-colors ${
                  acceptedRules ? 'border-pw-blue bg-pw-blue/5' : 'border-pw-border bg-pw-surface'
                }`}
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors flex-shrink-0 ${
                  acceptedRules ? 'border-pw-blue bg-pw-blue' : 'border-pw-border bg-pw-surface'
                }`}>
                  {acceptedRules && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className={`text-[13px] font-medium ${acceptedRules ? 'text-pw-blue' : 'text-pw-text'}`}>
                  Ik heb de huisregels gelezen en ga akkoord
                </span>
              </button>

              {error && <p className="mb-3 text-[11px] text-pw-red">{error}</p>}

              <button
                onClick={handleSave}
                disabled={saving || !acceptedRules}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
                {saving ? 'Opslaan...' : 'Start met de community'}
              </button>

              <p className="mt-3 text-[10px] text-pw-muted text-center leading-relaxed">
                Overtreding van de huisregels kan leiden tot een waarschuwing of blokkade van je community-account.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
