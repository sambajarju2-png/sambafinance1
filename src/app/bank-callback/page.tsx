'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Check, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

function BankCallbackContent() {
  const params = useSearchParams();
  const status = params.get('status');
  const error = params.get('error');
  const [triedClose, setTriedClose] = useState(false);

  useEffect(() => {
    // On native: try to auto-close the browser overlay after 2s
    async function tryClose() {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          setTimeout(async () => {
            try {
              const { Browser } = await import('@capacitor/browser');
              await Browser.close();
            } catch {
              setTriedClose(true);
            }
          }, 2000);
          return;
        }
      } catch {}
      // On web: redirect after 2s
      setTimeout(() => {
        window.location.href = status === 'error'
          ? `/instellingen?tab=bank&error=${error || 'callback_failed'}`
          : '/instellingen?tab=bank&bank=connected';
      }, 2000);
    }
    tryClose();
  }, [status, error]);

  const isError = status === 'error';
  const appUrl = 'https://app.paywatch.app/instellingen?tab=bank&bank=connected';

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(to bottom, #0A2540, #0F3460)' }}>
      
      {isError ? (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-full mb-5"
            style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
            <AlertCircle className="h-10 w-10 text-red-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-[22px] font-bold text-white mb-2">Verbinding mislukt</h1>
          <p className="text-[14px] text-white/60 text-center max-w-[280px] leading-relaxed">
            Er ging iets mis bij het koppelen van je bank. Probeer het opnieuw vanuit de app.
          </p>
        </>
      ) : (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-full mb-5"
            style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
            <Check className="h-10 w-10 text-green-400" strokeWidth={2} />
          </div>
          <h1 className="text-[22px] font-bold text-white mb-2">Bank gekoppeld!</h1>
          <p className="text-[14px] text-white/60 text-center max-w-[280px] leading-relaxed">
            Je bankrekening is succesvol verbonden met PayWatch.
          </p>
        </>
      )}

      {/* Primary CTA — always visible */}
      <a
        href={appUrl}
        className="mt-8 w-full max-w-[280px] flex items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white transition-transform active:scale-95"
        style={{ background: isError ? '#EF4444' : '#2563EB' }}
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        Ga terug naar de app
      </a>

      {/* Secondary info */}
      <div className="mt-4 flex items-center gap-2 text-white/30">
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
        <span className="text-[11px]">Wordt automatisch gesloten...</span>
      </div>

      {/* PayWatch branding */}
      <div className="absolute bottom-8 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
        <span className="text-[12px] font-semibold text-white/30">PayWatch</span>
      </div>
    </div>
  );
}

export default function BankCallbackPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0A2540' }}>
        <Loader2 className="h-6 w-6 animate-spin text-white" strokeWidth={1.5} />
      </div>
    }>
      <BankCallbackContent />
    </Suspense>
  );
}
