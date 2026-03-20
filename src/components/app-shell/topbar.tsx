'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Bell, Flame, Loader2, Sun, Moon } from 'lucide-react';

interface TopbarProps {
  displayName: string;
  streakCurrent: number;
  notificationCount: number;
}

export default function Topbar({ displayName, streakCurrent, notificationCount: initialCount }: TopbarProps) {
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const firstName = displayName?.split(' ')[0] || '';
  const [notifCount, setNotifCount] = useState(initialCount);
  const [currentLang, setCurrentLang] = useState<'nl' | 'en'>('nl');
  const [switching, setSwitching] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (typeof document !== 'undefined') setCurrentLang(document.documentElement.lang === 'en' ? 'en' : 'nl');
  }, []);

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

  async function handleLangSwitch() {
    if (switching) return;
    const newLang = currentLang === 'nl' ? 'en' : 'nl';
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
    <header className="glass-topbar sticky top-0 z-40 flex h-14 items-center justify-between border-b border-pw-border/50 px-4">
      <div className="flex items-center gap-3">
        <span className="text-[15px] font-bold tracking-tight text-pw-navy">PayWatch</span>
        {firstName && <span className="hidden text-body text-pw-muted sm:inline">Hoi, {firstName}</span>}
      </div>

      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button onClick={handleLangSwitch} disabled={switching}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-pw-border/50 text-[12px] transition-colors hover:bg-pw-border/30 disabled:opacity-50"
          aria-label="Switch language">
          {switching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-pw-muted" strokeWidth={2} /> : (
            <span>{currentLang === 'nl' ? '🇬🇧' : '🇳🇱'}</span>
          )}
        </button>

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

        {/* Streak */}
        {streakCurrent > 0 && (
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
            <span className="text-[14px] font-bold text-pw-blue">{streakCurrent}</span>
          </div>
        )}

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
