'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, ChevronRight, LayoutDashboard, CreditCard, BarChart3, ArrowLeftRight, Settings } from 'lucide-react';

const TOUR_STEPS = [
  { icon: LayoutDashboard, tabKey: 'overview', color: 'bg-pw-blue/10 text-pw-blue' },
  { icon: CreditCard, tabKey: 'payments', color: 'bg-pw-green/10 text-pw-green' },
  { icon: BarChart3, tabKey: 'stats', color: 'bg-pw-purple/10 text-pw-purple' },
  { icon: ArrowLeftRight, tabKey: 'cashflow', color: 'bg-amber-50 text-amber-600' },
  { icon: Settings, tabKey: 'settings', color: 'bg-pw-border/50 text-pw-muted' },
] as const;

export default function AppTour() {
  const t = useTranslations('tour');
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem('paywatch-tour-seen');
    if (!seen) {
      // Small delay so the app loads first
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleDismiss() {
    setShow(false);
    localStorage.setItem('paywatch-tour-seen', 'true');
  }

  function handleNext() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  }

  if (!show) return null;

  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/50" />

      {/* Dialog */}
      <div className="fixed inset-x-4 top-1/2 z-[60] -translate-y-1/2 mx-auto max-w-sm">
        <div className="rounded-card-lg bg-pw-surface p-6 shadow-[var(--shadow-modal)]">
          {/* Close */}
          <button onClick={handleDismiss} className="absolute right-3 top-3 p-1 text-pw-muted hover:text-pw-text">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {TOUR_STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-pw-blue' : i < step ? 'w-1.5 bg-pw-blue/40' : 'w-1.5 bg-pw-border'}`} />
            ))}
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-[18px] ${current.color}`}>
              <Icon className="h-8 w-8" strokeWidth={1.5} />
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h3 className="text-[18px] font-bold text-pw-navy">{t(`${current.tabKey}.title`)}</h3>
            <p className="mt-2 text-[13px] text-pw-muted leading-relaxed">{t(`${current.tabKey}.desc`)}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handleDismiss}
              className="flex-1 rounded-button border border-pw-border px-3 py-2.5 text-[13px] font-semibold text-pw-muted">
              {t('skip')}
            </button>
            <button onClick={handleNext}
              className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-button bg-pw-blue px-3 py-2.5 text-[13px] font-semibold text-white">
              {isLast ? t('getStarted') : t('next')}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
