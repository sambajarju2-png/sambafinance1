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
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);

    const wasDismissed = localStorage.getItem('pwa-drawer-dismissed');
    if (!wasDismissed) {
      const timer = setTimeout(() => setShowDrawer(true), 4000);
      return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler); };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

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

  if (isStandalone) return null;
  if (!showDrawer) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={handleDismiss} />
      <div className="drawer-enter fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-pw-border" /></div>

        <div className="px-5 pb-8 pt-4">
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

          <div className="mt-5 space-y-3">
            {isIOS ? (
              /* iOS Safari: Share button is at the BOTTOM of the screen */
              <>
                <StepCard number={1} title={t('iosStep1Title')} desc={t('iosStep1Desc')}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pw-blue/10">
                    <Share className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
                  </div>
                </StepCard>
                <StepCard number={2} title={t('iosStep2Title')} desc={t('iosStep2Desc')}>
                  <div className="flex items-center gap-1.5 rounded-lg bg-pw-border/30 px-2 py-1">
                    <Plus className="h-3.5 w-3.5 text-pw-text" strokeWidth={2} />
                    <span className="text-[10px] font-semibold text-pw-text">Add to Home Screen</span>
                  </div>
                </StepCard>
                <StepCard number={3} title={t('iosStep3Title')} desc={t('iosStep3Desc')}>
                  <div className="flex items-center gap-1 rounded-lg bg-pw-blue/10 px-2.5 py-1">
                    <span className="text-[10px] font-bold text-pw-blue">Add</span>
                  </div>
                </StepCard>
              </>
            ) : (
              /* Android/Desktop: Three dots menu */
              <>
                <StepCard number={1} title={t('androidStep1Title')} desc={t('androidStep1Desc')}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pw-border/30">
                    <MoreVertical className="h-4 w-4 text-pw-text" strokeWidth={1.5} />
                  </div>
                </StepCard>
                <StepCard number={2} title={t('androidStep2Title')} desc={t('androidStep2Desc')}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pw-blue/10">
                    <Download className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
                  </div>
                </StepCard>
                <StepCard number={3} title={t('androidStep3Title')} desc={t('androidStep3Desc')}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pw-green/10">
                    <Smartphone className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
                  </div>
                </StepCard>
              </>
            )}
          </div>

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

function StepCard({ number, title, desc, children }: { number: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-pw-border bg-pw-surface p-3.5">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-pw-blue/10 text-[12px] font-bold text-pw-blue">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {children}
          <p className="text-[13px] font-semibold text-pw-text">{title}</p>
        </div>
        <p className="mt-1 text-[11px] text-pw-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
