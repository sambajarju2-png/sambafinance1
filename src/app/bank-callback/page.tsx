'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

function BankCallbackContent() {
  const params = useSearchParams();
  const status = params.get('status'); // 'success' | 'error'
  const error = params.get('error');
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    async function handleCallback() {
      // On native: close the SFSafariViewController overlay
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { Browser } = await import('@capacitor/browser');
          setClosing(true);
          // Small delay so user sees the success message
          setTimeout(async () => {
            try {
              await Browser.close();
            } catch {
              // If Browser.close() fails, redirect normally
              window.location.href = '/instellingen?tab=bank&bank=connected';
            }
          }, 1200);
          return;
        }
      } catch {}

      // On web: redirect to settings after brief pause
      setTimeout(() => {
        if (status === 'success') {
          window.location.href = '/instellingen?tab=bank&bank=connected';
        } else {
          window.location.href = `/instellingen?tab=bank&error=${error || 'callback_failed'}`;
        }
      }, 1500);
    }

    handleCallback();
  }, [status, error]);

  const isError = status === 'error';

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0A2540] text-white px-6">
      {isError ? (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <AlertCircle className="h-8 w-8 text-red-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-[20px] font-bold mb-2">Verbinding mislukt</h1>
          <p className="text-[14px] text-white/60 text-center">
            Er ging iets mis bij het koppelen. Probeer het opnieuw.
          </p>
        </>
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 mb-4">
            <Check className="h-8 w-8 text-green-400" strokeWidth={2} />
          </div>
          <h1 className="text-[20px] font-bold mb-2">Bank gekoppeld!</h1>
          <p className="text-[14px] text-white/60 text-center">
            Je bankrekening is succesvol verbonden.
          </p>
        </>
      )}
      <div className="mt-6 flex items-center gap-2 text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        <span className="text-[12px]">{closing ? 'Terug naar PayWatch...' : 'Even geduld...'}</span>
      </div>
    </div>
  );
}

export default function BankCallbackPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-[#0A2540]">
        <Loader2 className="h-6 w-6 animate-spin text-white" strokeWidth={1.5} />
      </div>
    }>
      <BankCallbackContent />
    </Suspense>
  );
}
