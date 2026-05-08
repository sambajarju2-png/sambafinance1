'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Check, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

function BankCallbackContent() {
  const params = useSearchParams();
  const status = params.get('status');
  const error = params.get('error');
  const [showManualClose, setShowManualClose] = useState(false);

  // The custom URL scheme registered in Info.plist
  const appScheme = 'nl.paywatch.app://instellingen?tab=bank&bank=connected';
  const appUrl = 'https://app.paywatch.app/instellingen?tab=bank&bank=connected';

  useEffect(() => {
    async function tryAutoClose() {
      // Step 1: Try Capacitor Browser.close() (works if opened via Browser plugin)
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { Browser } = await import('@capacitor/browser');
          setTimeout(async () => {
            try { await Browser.close(); } catch { setShowManualClose(true); }
          }, 1500);
          return;
        }
      } catch {}

      // Step 2: We're in Safari/SFSafariViewController (not WKWebView).
      // Try the custom URL scheme to jump back into the app.
      setTimeout(() => {
        const targetPath = status === 'error'
          ? `instellingen?tab=bank&error=${error || 'callback_failed'}`
          : 'instellingen?tab=bank&bank=connected';

        // Try URL scheme first (opens the native app from Safari)
        window.location.href = `nl.paywatch.app://${targetPath}`;

        // Fallback after 1s: if URL scheme didn't work (e.g. web browser, app not installed),
        // redirect to the web URL
        setTimeout(() => {
          window.location.href = `https://app.paywatch.app/${targetPath}`;
        }, 1000);
      }, 1500);
    }
    tryAutoClose();

    setTimeout(() => setShowManualClose(true), 3000);
  }, [status, error]);

  function handleBackToApp() {
    // Try custom URL scheme first (opens the app directly from Safari)
    window.location.href = appScheme;
    // Fallback: if scheme doesn't work after 500ms, try the web URL
    setTimeout(() => {
      window.location.href = appUrl;
    }, 500);
  }

  const isError = status === 'error';

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
            Er ging iets mis bij het koppelen. Probeer het opnieuw vanuit de app.
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

      {/* Primary CTA — opens app via custom URL scheme */}
      <button
        onClick={handleBackToApp}
        className="mt-8 w-full max-w-[280px] flex items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white transition-transform active:scale-95"
        style={{ background: isError ? '#EF4444' : '#2563EB' }}
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        Ga terug naar PayWatch
      </button>

      {/* Manual close instructions — shown after 3s */}
      {showManualClose && (
        <div className="mt-6 text-center max-w-[260px] animate-in fade-in duration-300">
          <p className="text-[12px] text-white/50 leading-relaxed">
            Lukt het niet? Sluit dit venster en open de PayWatch app opnieuw.
          </p>
        </div>
      )}

      {/* Spinner */}
      <div className="mt-4 flex items-center gap-2 text-white/25">
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
