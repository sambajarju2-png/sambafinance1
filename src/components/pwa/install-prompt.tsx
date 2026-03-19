'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Download, X, Share, Plus, MoreVertical, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallDrawer() {
  const t = useTranslations('pwa');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    // Check if already running as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return; // Already installed, never show

    // Detect platform
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    // Listen for Chrome/Edge native install prompt
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);

    // Auto-show after 4 seconds for ALL mobile users who haven't dismissed
    const wasDismissed = localStorage.getItem('pwa-drawer-dismissed');
    if (!wasDismissed) {
      const timer = setTimeout(() => setShowDrawer(true), 4000);
      return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler); };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Admin trigger
  useEffect(() => {
    function handleTrigger() { setShowDrawer(true); }
    window.addEventListener('paywatch-trigger-pwa', handleTrigger);
    return () => window.removeEventListener('paywatch-trigger-pwa', handleTrigger);
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { setShowDrawer(false); setDeferredPrompt(null); }
    }
  }

  function handleDismiss() {
    setShowDrawer(false);
    localStorage.setItem('pwa-drawer-dismissed', 'true');
  }

  // Don't render if already standalone
  if (isStandalone) return null;
  if (!showDrawer) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={handleDismiss} />
      <div className="drawer-enter fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-pw-border" /></div>

        <div className="px-5 pb-8 pt-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-pw-blue/10">
                <Smartphone className="h-6 w-6 text-pw-blue" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-pw-navy">{t('installTitle')}</h2>
                <p className="text-[12px] text-pw-muted">{t('installDesc')}</p>
              </div>
            </div>
            <button onClick={handleDismiss} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Step-by-step instructions */}
          <div className="mt-5 space-y-3">
            {isIOS ? (
              <>
                <StepCard number={1} icon={Share} title={t('iosStep1Title')} desc={t('iosStep1Desc')} />
                <StepCard number={2} icon={Plus} title={t('iosStep2Title')} desc={t('iosStep2Desc')} />
                <StepCard number={3} icon={Smartphone} title={t('iosStep3Title')} desc={t('iosStep3Desc')} />
              </>
            ) : (
              <>
                <StepCard number={1} icon={MoreVertical} title={t('androidStep1Title')} desc={t('androidStep1Desc')} />
                <StepCard number={2} icon={Download} title={t('androidStep2Title')} desc={t('androidStep2Desc')} />
                <StepCard number={3} icon={Smartphone} title={t('androidStep3Title')} desc={t('androidStep3Desc')} />
              </>
            )}
          </div>

          {/* Native install button — only shows on Chrome/Edge when browser supports it */}
          {deferredPrompt && (
            <button onClick={handleInstall}
              className="btn-press mt-5 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white">
              <Download className="h-4 w-4" strokeWidth={1.5} /> {t('install')}
            </button>
          )}

          <button onClick={handleDismiss} className="mt-3 w-full text-center text-[12px] font-medium text-pw-muted">
            {t('maybeLater')}
          </button>
        </div>
      </div>
    </>
  );
}

function StepCard({ number, icon: Icon, title, desc }: { number: number; icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-pw-border bg-pw-surface p-3.5">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-pw-blue/10 text-[12px] font-bold text-pw-blue">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-pw-muted" strokeWidth={1.5} />
          <p className="text-[13px] font-semibold text-pw-text">{title}</p>
        </div>
        <p className="mt-0.5 text-[11px] text-pw-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
