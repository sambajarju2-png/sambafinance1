'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Bell, Loader2, Sun, Moon, Settings, Check } from 'lucide-react';
import { useStatusBar } from '@/lib/use-status-bar';
import { LOCALES, LOCALE_META, DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale-meta';

interface TopbarProps {
  notificationCount: number;
}

export default function Topbar({ notificationCount: initialCount }: TopbarProps) {
  const t = useTranslations('nav');
  const router = useRouter();

  // Default: dark text on light background (overridden by voice call / biometric lock)
  useStatusBar('dark');
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [notifCount, setNotifCount] = useState(initialCount);
  const [currentLang, setCurrentLang] = useState<Locale>(DEFAULT_LOCALE);
  const [switching, setSwitching] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  // Fetch live notification count
  useEffect(() => {
    // Don't fetch if cleared this session
    if (sessionStorage.getItem('pw-notif-cleared')) { setNotifCount(0); return; }
    async function fetchCount() {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) { const data = await res.json(); setNotifCount(data.count || 0); }
      } catch {}
    }
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Listen for clear event from notifications page
  useEffect(() => {
    function handleClear() { setNotifCount(0); }
    window.addEventListener('pw-notif-cleared', handleClear);
    return () => window.removeEventListener('pw-notif-cleared', handleClear);
  }, []);

  async function selectLang(newLang: Locale) {
    setLangMenuOpen(false);
    if (switching || newLang === currentLang) return;
    setSwitching(true);
    try {
      await fetch('/api/settings/language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: newLang }) });
      window.location.reload();
    } catch { setSwitching(false); }
  }

  function handleBellClick() {
    if (pathname === '/notifications') router.push('/overzicht');
    else router.push('/notifications');
  }

  function handleThemeToggle() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <header
      className="glass-topbar sticky top-0 z-40 flex h-14 items-center justify-between border-b border-pw-border/50 px-4"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(56px + env(safe-area-inset-top, 0px))' }}
    >
      <div className="flex items-center gap-3">
        <img src="/logo.svg" alt="PayWatch" className="h-5 dark:hidden" />
        <img src="/logo-dark.svg" alt="PayWatch" className="h-5 hidden dark:block" />
      </div>

      <div className="flex items-center gap-2">
        {/* Language selector */}
        <div className="relative" ref={langMenuRef}>
          <button onClick={() => setLangMenuOpen(v => !v)} disabled={switching}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-pw-border/50 text-[12px] transition-colors hover:bg-pw-border/30 disabled:opacity-50"
            aria-label="Change language" aria-haspopup="menu" aria-expanded={langMenuOpen}>
            {switching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-pw-muted" strokeWidth={2} /> : (
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

        {/* Dark mode toggle */}
        {mounted && (
          <button onClick={handleThemeToggle}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-pw-border/50 transition-all hover:bg-pw-border/30"
            aria-label="Toggle dark mode">
            {theme === 'dark'
              ? <Sun className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} />
              : <Moon className="h-3.5 w-3.5 text-pw-muted" strokeWidth={1.5} />}
          </button>
        )}

        {/* Settings */}
        <button onClick={() => router.push('/instellingen')}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            pathname === '/instellingen' ? 'bg-pw-blue/10 text-pw-blue' : 'border border-pw-border/50 text-pw-muted hover:bg-pw-border/30'}`}
          aria-label="Settings">
          <Settings className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Bell */}
        <button onClick={handleBellClick}
          className={`relative flex h-9 w-9 items-center justify-center rounded-input transition-colors ${
            pathname === '/notifications' ? 'bg-pw-blue/10 text-pw-blue' : 'text-pw-muted hover:bg-pw-border/30 hover:text-pw-text'}`}
          aria-label={t('notifications')}>
          <Bell className="h-5 w-5" strokeWidth={1.5} />
          {notifCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pw-red px-1 text-[10px] font-semibold text-white">
              {notifCount > 99 ? '99+' : notifCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
