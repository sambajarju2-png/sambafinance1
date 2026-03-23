'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  X,
  ChevronRight,
  LayoutDashboard,
  CreditCard,
  Users,
  TrendingUp,
  MoreHorizontal,
} from 'lucide-react';

/* ─── Tour steps — matches bottom-nav exactly ─── */
const TOUR_STEPS = [
  { icon: LayoutDashboard, tabKey: 'overview' as const, route: '/overzicht', color: 'bg-pw-blue/10 text-pw-blue', navIndex: 0 },
  { icon: CreditCard, tabKey: 'payments' as const, route: '/betalingen', color: 'bg-pw-green/10 text-pw-green', navIndex: 1 },
  { icon: Users, tabKey: 'feed' as const, route: '/feed', color: 'bg-pw-blue/10 text-pw-blue', navIndex: 2 },
  { icon: TrendingUp, tabKey: 'stats' as const, route: '/stats', color: 'bg-pw-purple/10 text-pw-purple', navIndex: 3 },
  { icon: MoreHorizontal, tabKey: 'settings' as const, route: '/instellingen', color: 'bg-pw-border/50 text-pw-muted', navIndex: 4 },
] as const;

export default function AppTour() {
  const t = useTranslations('tour');
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);
  const [entering, setEntering] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const seen = localStorage.getItem('paywatch-tour-seen');
    if (!seen) {
      const timer = setTimeout(() => {
        setShow(true);
        setEntering(true);
        // Remove entering class after entrance animation
        setTimeout(() => setEntering(false), 500);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for admin trigger (settings → "Rondleiding herstarten")
  useEffect(() => {
    function handleTrigger() {
      setStep(0);
      setDirection('next');
      setShow(true);
      setEntering(true);
      setTimeout(() => setEntering(false), 500);
    }
    window.addEventListener('paywatch-trigger-tour', handleTrigger);
    return () => window.removeEventListener('paywatch-trigger-tour', handleTrigger);
  }, []);

  const handleDismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem('paywatch-tour-seen', 'true');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleNext = useCallback(() => {
    if (animating) return;
    if (step < TOUR_STEPS.length - 1) {
      setAnimating(true);
      setDirection('next');
      const nextStep = step + 1;
      // Short delay for exit animation, then switch step
      timeoutRef.current = setTimeout(() => {
        setStep(nextStep);
        router.push(TOUR_STEPS[nextStep].route);
        // Let entrance animation play
        setTimeout(() => setAnimating(false), 350);
      }, 150);
    } else {
      handleDismiss();
      router.push('/overzicht');
    }
  }, [step, animating, router, handleDismiss]);

  const handlePrev = useCallback(() => {
    if (animating || step === 0) return;
    setAnimating(true);
    setDirection('prev');
    const prevStep = step - 1;
    timeoutRef.current = setTimeout(() => {
      setStep(prevStep);
      router.push(TOUR_STEPS[prevStep].route);
      setTimeout(() => setAnimating(false), 350);
    }, 150);
  }, [step, animating, router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!show) return null;

  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <>
      {/* Scoped keyframe animations */}
      <style jsx global>{`
        @keyframes tour-enter {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes tour-slide-next {
          0% { opacity: 0; transform: translateX(40px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes tour-slide-prev {
          0% { opacity: 0; transform: translateX(-40px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes tour-icon-pop {
          0% { opacity: 0; transform: scale(0.5); }
          60% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes tour-pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes tour-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(37, 99, 235, 0.3); }
          50% { box-shadow: 0 0 35px rgba(37, 99, 235, 0.5); }
        }
        @keyframes tour-dot-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes tour-backdrop-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes tour-nav-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        .tour-content-enter-next {
          animation: tour-slide-next 400ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .tour-content-enter-prev {
          animation: tour-slide-prev 400ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        style={{
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'tour-backdrop-in 400ms ease-out both',
        }}
      />

      {/* Bottom nav indicator — pulsing dot showing which tab */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[61] flex items-center justify-around"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)', paddingTop: '6px', height: '72px' }}
      >
        {TOUR_STEPS.map((s, i) => {
          const NavIcon = s.icon;
          const isActive = i === step;
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-center gap-1 relative">
              {isActive && (
                <>
                  {/* Pulse ring */}
                  <div
                    className="absolute rounded-full bg-pw-blue/20"
                    style={{
                      width: 48,
                      height: 48,
                      top: '50%',
                      left: '50%',
                      marginTop: -28,
                      marginLeft: -24,
                      animation: 'tour-pulse-ring 1.5s ease-out infinite',
                    }}
                  />
                </>
              )}
              <div
                style={{
                  animation: isActive ? 'tour-nav-pulse 2s ease-in-out infinite' : 'none',
                }}
              >
                {s.tabKey === 'feed' ? (
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isActive ? 'bg-pw-blue shadow-md shadow-pw-blue/30' : 'bg-white/10'
                    }`}
                  >
                    <NavIcon
                      className={`h-5 w-5 ${isActive ? 'text-white' : 'text-white/40'}`}
                      strokeWidth={1.5}
                    />
                  </div>
                ) : (
                  <NavIcon
                    className={`h-6 w-6 ${isActive ? 'text-pw-blue' : 'text-white/30'}`}
                    strokeWidth={1.5}
                  />
                )}
              </div>
              {isActive && (
                <div
                  className="h-1 w-1 rounded-full bg-pw-blue"
                  style={{ animation: 'tour-dot-bounce 1.2s ease-in-out infinite' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Main tour card */}
      <div
        className="fixed z-[62] w-[calc(100%-32px)] max-w-sm"
        style={{
          top: '45%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: entering ? 'tour-enter 500ms cubic-bezier(0.22, 1, 0.36, 1) both' : 'none',
        }}
      >
        <div
          className="rounded-card-lg bg-pw-surface p-6 relative overflow-hidden"
          style={{ boxShadow: '0 8px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255,255,255,0.05)' }}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-pw-bg/50 text-pw-muted hover:text-pw-text transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>

          {/* Step dots — animated */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === step ? 24 : 6,
                  height: 6,
                  background: i === step
                    ? 'var(--blue)'
                    : i < step
                      ? 'var(--blue)'
                      : 'var(--border)',
                  opacity: i === step ? 1 : i < step ? 0.4 : 0.3,
                  transition: 'all 400ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            ))}
          </div>

          {/* Animated content area */}
          <div
            key={step}
            className={direction === 'next' ? 'tour-content-enter-next' : 'tour-content-enter-prev'}
          >
            {/* Icon with glow effect */}
            <div className="flex justify-center mb-5">
              <div className="relative">
                {/* Glow ring */}
                <div
                  className="absolute inset-[-8px] rounded-[22px]"
                  style={{ animation: 'tour-glow 2s ease-in-out infinite' }}
                />
                <div
                  className={`relative flex h-16 w-16 items-center justify-center rounded-[18px] ${current.color}`}
                  style={{ animation: 'tour-icon-pop 500ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
                >
                  <Icon className="h-8 w-8" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            {/* Title + description */}
            <div className="text-center mb-6">
              <h3 className="text-[18px] font-bold text-pw-navy">
                {t(`${current.tabKey}.title`)}
              </h3>
              <p className="mt-2 text-[13px] text-pw-muted leading-relaxed max-w-[260px] mx-auto">
                {t(`${current.tabKey}.desc`)}
              </p>
            </div>

            {/* Step counter */}
            <p className="text-center text-[11px] text-pw-muted/60 mb-5 font-medium">
              {step + 1} / {TOUR_STEPS.length}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {isFirst ? (
              <button
                onClick={handleDismiss}
                className="flex-1 rounded-button border border-pw-border px-3 py-2.5 text-[13px] font-semibold text-pw-muted active:scale-[0.97] transition-transform"
              >
                {t('skip')}
              </button>
            ) : (
              <button
                onClick={handlePrev}
                className="flex-1 rounded-button border border-pw-border px-3 py-2.5 text-[13px] font-semibold text-pw-muted active:scale-[0.97] transition-transform"
              >
                {t('skip')}
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={animating}
              className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-button bg-pw-blue px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-70 active:scale-[0.97] transition-transform"
            >
              {isLast ? t('getStarted') : t('next')}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
