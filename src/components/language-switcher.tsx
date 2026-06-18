'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { LOCALES, LOCALE_META, DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale-meta';

export default function LanguageSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState<Locale>(() => {
    if (typeof document !== 'undefined' && isLocale(document.documentElement.lang)) {
      return document.documentElement.lang as Locale;
    }
    return DEFAULT_LOCALE;
  });

  async function handleSwitch(lang: Locale) {
    if (lang === current || isPending) return;

    const prev = current;
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
        setCurrent(prev); // Revert on failure
      }
    } catch {
      setCurrent(prev);
    }
  }

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <p className="text-[14px] font-semibold text-pw-text">Taal / Language</p>
      <p className="text-[11px] text-pw-muted">{LOCALE_META[current].label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {LOCALES.map((lang) => (
          <button
            key={lang}
            onClick={() => handleSwitch(lang)}
            disabled={isPending}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
              current === lang
                ? 'bg-pw-blue/10 text-pw-blue ring-1 ring-pw-blue/30'
                : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
            } ${isPending ? 'opacity-60' : ''}`}
          >
            <span className="text-[14px]">{LOCALE_META[lang].flag}</span> {lang.toUpperCase()}
            {isPending && current === lang && <Loader2 className="ml-0.5 h-3 w-3 animate-spin" strokeWidth={2} />}
          </button>
        ))}
      </div>
    </div>
  );
}
