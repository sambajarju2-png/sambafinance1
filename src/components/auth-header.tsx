'use client';
import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon, Loader2, Check } from 'lucide-react';
import { LOCALES, LOCALE_META, DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale-meta';

export default function AuthHeader() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentLang, setCurrentLang] = useState<Locale>(DEFAULT_LOCALE);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (typeof document !== 'undefined' && isLocale(document.documentElement.lang)) setCurrentLang(document.documentElement.lang as Locale);
  }, []);

  // Close the language menu when clicking outside it
  useEffect(() => {
    if (!langMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [langMenuOpen]);

  function selectLang(newLang: Locale) {
    setLangMenuOpen(false);
    if (newLang === currentLang) return;
    setCurrentLang(newLang); // Optimistic update
    // Set cookie directly (auth pages don't have API session)
    document.cookie = `paywatch-locale=${newLang};path=/;max-age=31536000;samesite=lax`;
    // Soft refresh instead of hard reload
    startTransition(() => { router.refresh(); });
  }

  return (
    <div className="flex items-center justify-end gap-2 px-4 pt-3">
      <div className="relative" ref={langMenuRef}>
        <button onClick={() => setLangMenuOpen(v => !v)} disabled={isPending}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-pw-border/50 text-[12px] transition-colors hover:bg-pw-border/30 disabled:opacity-50"
          aria-label="Change language" aria-haspopup="menu" aria-expanded={langMenuOpen}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-pw-muted" strokeWidth={2} /> : (
            <span>{LOCALE_META[currentLang].flag}</span>
          )}
        </button>
        {langMenuOpen && (
          <div role="menu"
            className="absolute right-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-xl border border-pw-border bg-pw-surface py-1 shadow-lg">
            {LOCALES.map((loc) => (
              <button key={loc} role="menuitem" onClick={() => selectLang(loc)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-pw-border/30 ${
                  loc === currentLang ? 'font-semibold text-pw-blue' : 'text-pw-text'
                }`}>
                <span className="text-[15px]">{LOCALE_META[loc].flag}</span>
                <span>{LOCALE_META[loc].label}</span>
                {loc === currentLang && <Check className="ml-auto h-3.5 w-3.5 text-pw-blue" strokeWidth={2.5} />}
              </button>
            ))}
          </div>
        )}
      </div>
      {mounted && (
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-pw-border/50 transition-all hover:bg-pw-border/30">
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} /> : <Moon className="h-3.5 w-3.5 text-pw-muted" strokeWidth={1.5} />}
        </button>
      )}
    </div>
  );
}
