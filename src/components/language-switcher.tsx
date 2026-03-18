'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function LanguageSwitcher() {
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<'nl' | 'en'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.lang === 'en' ? 'en' : 'nl';
    }
    return 'nl';
  });

  async function handleSwitch(lang: 'nl' | 'en') {
    if (lang === current) return;
    setSaving(true);

    try {
      await fetch('/api/settings/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });

      setCurrent(lang);
      // Full reload to pick up new locale
      window.location.reload();
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-semibold text-pw-text">Taal / Language</p>
          <p className="text-[11px] text-pw-muted">
            {current === 'nl' ? 'Nederlands' : 'English'}
          </p>
        </div>

        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin text-pw-muted" strokeWidth={2} />
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => handleSwitch('nl')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                current === 'nl'
                  ? 'bg-pw-blue/10 text-pw-blue ring-1 ring-pw-blue/30'
                  : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
              }`}
            >
              <span className="text-[14px]">🇳🇱</span>
              NL
            </button>
            <button
              onClick={() => handleSwitch('en')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                current === 'en'
                  ? 'bg-pw-blue/10 text-pw-blue ring-1 ring-pw-blue/30'
                  : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
              }`}
            >
              <span className="text-[14px]">🇬🇧</span>
              EN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
