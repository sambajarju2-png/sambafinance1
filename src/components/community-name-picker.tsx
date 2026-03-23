'use client';

import { useState } from 'react';
import { X, Loader2, ShieldCheck, Ban, Megaphone, Heart } from 'lucide-react';

interface CommunityNamePickerProps {
  onComplete: (name: string) => void;
  onClose: () => void;
}

export default function CommunityNamePicker({ onComplete, onClose }: CommunityNamePickerProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [acceptedRules, setAcceptedRules] = useState(false);

  const avatarUrl = name.trim()
    ? `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(name.trim())}`
    : `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=default`;

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Minimaal 2 tekens');
      return;
    }
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
        body: JSON.stringify({ display_name: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Er ging iets mis');
        return;
      }

      onComplete(trimmed);
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[18px] font-bold text-pw-navy">Welkom bij de community!</h2>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Avatar preview */}
          <div className="flex flex-col items-center mb-6">
            <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-pw-border bg-pw-surface">
              <img src={avatarUrl} alt="Avatar" className="h-full w-full" />
            </div>
            <p className="mt-2 text-[12px] text-pw-muted">Je avatar wordt gegenereerd op basis van je naam</p>
          </div>

          {/* Name input */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[12px] font-medium text-pw-text">
              Kies je community naam
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 30))}
              placeholder="Bijv. FinanceHero, SpaarKoning..."
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3.5 py-2.5 text-[14px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-pw-muted">
              Dit kan anders zijn dan je echte naam. Anoniem posten is altijd mogelijk.
            </p>
          </div>

          {/* House rules */}
          <div className="mb-4 rounded-card border border-pw-border bg-pw-surface p-3.5">
            <p className="text-[12px] font-semibold text-pw-navy mb-2.5">Huisregels</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <Heart className="h-3.5 w-3.5 text-pw-blue mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-[11px] text-pw-muted leading-relaxed">Wees respectvol en ondersteunend naar andere leden</p>
              </div>
              <div className="flex items-start gap-2.5">
                <Ban className="h-3.5 w-3.5 text-pw-red mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-[11px] text-pw-muted leading-relaxed">Geen discriminatie, beledigingen of haatspraak</p>
              </div>
              <div className="flex items-start gap-2.5">
                <Megaphone className="h-3.5 w-3.5 text-pw-amber mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-[11px] text-pw-muted leading-relaxed">Geen reclame, spam of promotie van producten/diensten</p>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-3.5 w-3.5 text-pw-green mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-[11px] text-pw-muted leading-relaxed">Deel geen persoonlijke financiële gegevens van anderen</p>
              </div>
            </div>

            {/* Accept checkbox */}
            <button
              onClick={() => setAcceptedRules(!acceptedRules)}
              className="mt-3 flex w-full items-center gap-2.5 rounded-input border border-pw-border bg-pw-bg px-3 py-2.5 text-left transition-colors"
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-[4px] border-2 transition-colors flex-shrink-0 ${
                acceptedRules ? 'border-pw-blue bg-pw-blue' : 'border-pw-border bg-pw-surface'
              }`}>
                {acceptedRules && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className="text-[12px] text-pw-text">Ik ga akkoord met de huisregels</span>
            </button>
          </div>

          {error && <p className="mb-3 text-[11px] text-pw-red">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !acceptedRules}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
            {saving ? 'Opslaan...' : 'Start met de community'}
          </button>

          <p className="mt-3 text-[10px] text-pw-muted text-center leading-relaxed">
            Overtreding van de huisregels kan leiden tot een waarschuwing of blokkade van je community-account.
          </p>
        </div>
      </div>
    </>
  );
}
