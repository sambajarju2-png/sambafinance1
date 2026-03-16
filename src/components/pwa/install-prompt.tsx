'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const t = useTranslations('pwa');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Check if dismissed before
    const wasDismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) setDismissed(true);

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    // Listen for the beforeinstallprompt event (Chrome/Edge/Samsung)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Don't show if already installed, dismissed, or no prompt available (and not iOS)
  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  }

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-30 mx-auto max-w-md">
      <div className="toast-enter flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface p-3 shadow-[var(--shadow-toast)]">
        {/* Icon */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-input bg-pw-blue/10">
          <Download className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-pw-text">{t('installTitle')}</p>
          <p className="text-[11px] text-pw-muted">
            {isIOS ? t('installIOS') : t('installDesc')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="btn-press rounded-button bg-pw-blue px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              {t('install')}
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="flex h-7 w-7 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
