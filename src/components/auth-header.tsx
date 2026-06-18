'use client';
import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon, Loader2 } from 'lucide-react';
import { LOCALES, LOCALE_META, DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale-meta';

export default function AuthHeader() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentLang, setCurrentLang] = useState<Locale>(DEFAULT_LOCALE);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (typeof document !== 'undefined' && isLocale(document.documentElement.lang)) setCurrentLang(document.documentElement.lang as Locale);
  }, []);

  async function handleLangSwitch() {
    if (isPending) return;
    const newLang = LOCALES[(LOCALES.indexOf(currentLang) + 1) % LOCALES.length];
    setCurrentLang(newLang); // Optimistic update

    // Set cookie directly (auth pages don't have API session)
    document.cookie = `paywatch-locale=${newLang};path=/;max-age=31536000;samesite=lax`;

    // Soft refresh instead of hard reload
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2 px-4 pt-3">
      <button onClick={handleLangSwitch} disabled={isPending}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-pw-border/50 text-[12px] transition-colors hover:bg-pw-border/30 disabled:opacity-50">
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-pw-muted" strokeWidth={2} /> : (
          <span>{LOCALE_META[currentLang].flag}</span>
        )}
      </button>
      {mounted && (
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-pw-border/50 transition-all hover:bg-pw-border/30">
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} /> : <Moon className="h-3.5 w-3.5 text-pw-muted" strokeWidth={1.5} />}
        </button>
      )}
    </div>
  );
}
