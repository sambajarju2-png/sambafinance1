'use client';

import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { localeFromCookie, pick } from '@/lib/i18n-pick';

/**
 * Full-screen offline overlay.
 * Detects when the device loses internet and shows a branded PayWatch screen.
 * Auto-hides when connection returns. Apple App Review WILL test this.
 */
export default function OfflineDetector() {
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    function handleOffline() { setOffline(true); }
    function handleOnline() { setOffline(false); }

    // Check initial state
    if (!navigator.onLine) setOffline(true);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  async function handleRetry() {
    setRetrying(true);
    try {
      // Try to reach the server
      const res = await fetch('/api/settings/profile', { method: 'HEAD' });
      if (res.ok) {
        setOffline(false);
        window.location.reload();
      }
    } catch {
      // Still offline
    } finally {
      setRetrying(false);
    }
  }

  if (!offline) return null;

  const lang = localeFromCookie();

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-pw-bg dark:bg-gray-900 px-8">
      <div className="flex flex-col items-center text-center max-w-[300px]">
        {/* Logo */}
        <div className="mb-6">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#2563EB"/>
            <path d="M16 20h16M16 28h10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="34" cy="28" r="4" fill="white" opacity="0.6"/>
          </svg>
        </div>

        {/* Wifi off icon */}
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8 text-pw-muted" strokeWidth={1.5} />
        </div>

        <h1 className="text-[22px] font-bold text-pw-text dark:text-white mb-2">
          {pick(lang, { nl: 'Geen internetverbinding', en: 'No internet connection', pl: 'Brak połączenia z internetem', tr: 'İnternet bağlantısı yok' })}
        </h1>

        <p className="text-[14px] text-pw-muted leading-relaxed mb-8">
          {pick(lang, {
            nl: 'Controleer je wifi of mobiele data en probeer het opnieuw.',
            en: 'Check your wifi or mobile data and try again.',
            pl: 'Sprawdź swoje wifi lub dane mobilne i spróbuj ponownie.',
            tr: 'Wifi veya mobil verini kontrol et ve tekrar dene.',
          })}
        </p>

        <button
          onClick={handleRetry}
          disabled={retrying}
          className="flex items-center gap-2 rounded-xl bg-pw-blue px-6 py-3 text-[14px] font-semibold text-white active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} strokeWidth={2} />
          {retrying
            ? pick(lang, { nl: 'Verbinden...', en: 'Connecting...', pl: 'Łączenie...', tr: 'Bağlanılıyor...' })
            : pick(lang, { nl: 'Opnieuw proberen', en: 'Try again', pl: 'Spróbuj ponownie', tr: 'Tekrar dene' })}
        </button>
      </div>
    </div>
  );
}
