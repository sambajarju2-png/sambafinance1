'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LanguageSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState<'nl' | 'en'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.lang === 'en' ? 'en' : 'nl';
    }
    return 'nl';
  });

  async function handleSwitch(lang: 'nl' | 'en') {
    if (lang === current || isPending) return;

    // Optimistic UI update
    setCurrent(lang);

    try {
      const res = await fetch('/api/settings/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });

      if (res.ok) {
        // Soft refresh — re-runs server components (getLocale + getMessages)
        // without a full page reload. Instant language switch.
        startTransition(() => {
          router.refresh();
        });
      } else {
        // Revert on failure
        setCurrent(current);
      }
    } catch {
      setCurrent(current);
    }
  }

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-semibold text-pw-text">Taal / Language</p>
          <p className="text-[11px] text-pw-muted">{current === 'nl' ? 'Nederlands' : 'English'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleSwitch('nl')} disabled={isPending}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
              current === 'nl' ? 'bg-pw-blue/10 text-pw-blue ring-1 ring-pw-blue/30' : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
            } ${isPending ? 'opacity-60' : ''}`}>
            <span className="text-[14px]">🇳🇱</span> NL
            {isPending && current === 'nl' && <Loader2 className="ml-0.5 h-3 w-3 animate-spin" strokeWidth={2} />}
          </button>
          <button onClick={() => handleSwitch('en')} disabled={isPending}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
              current === 'en' ? 'bg-pw-blue/10 text-pw-blue ring-1 ring-pw-blue/30' : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
            } ${isPending ? 'opacity-60' : ''}`}>
            <span className="text-[14px]">🇬🇧</span> EN
            {isPending && current === 'en' && <Loader2 className="ml-0.5 h-3 w-3 animate-spin" strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  );
}
