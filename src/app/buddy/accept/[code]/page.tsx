'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Check, Loader2, AlertTriangle, LogIn } from 'lucide-react';

export default function BuddyAcceptPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'accepted' | 'error' | 'login'>('loading');
  const [error, setError] = useState('');
  const [ownerName, setOwnerName] = useState('');

  useEffect(() => {
    async function checkAuth() {
      try {
        // Check if user is logged in by trying to hit a protected endpoint
        const res = await fetch('/api/settings/profile');
        if (res.status === 401) {
          // Not logged in — save code and redirect to login
          sessionStorage.setItem('buddy-invite-code', params.code);
          setStatus('login');
          return;
        }
        setStatus('ready');
      } catch {
        setStatus('login');
      }
    }
    checkAuth();
  }, [params.code]);

  // Check on mount if we have a pending invite from before login
  useEffect(() => {
    const pending = sessionStorage.getItem('buddy-invite-code');
    if (pending && status === 'ready') {
      sessionStorage.removeItem('buddy-invite-code');
      handleAccept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleAccept() {
    setStatus('accepting');
    setError('');
    try {
      const res = await fetch('/api/buddies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: params.code }),
      });
      if (res.ok) {
        setStatus('accepted');
      } else {
        const data = await res.json();
        setError(data.error || 'Er ging iets mis');
        setStatus('error');
      }
    } catch {
      setError('Verbindingsfout');
      setStatus('error');
    }
  }

  function handleLogin() {
    sessionStorage.setItem('buddy-invite-code', params.code);
    router.push('/auth/login');
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-pw-bg px-6">
      <div className="w-full max-w-[360px]">
        <div className="rounded-card-lg border border-pw-border bg-pw-surface p-8 text-center" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>

          {/* Loading */}
          {status === 'loading' && (
            <>
              <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-pw-blue" strokeWidth={1.5} />
              <p className="text-[14px] text-pw-muted">Uitnodiging laden...</p>
            </>
          )}

          {/* Need to login first */}
          {status === 'login' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pw-blue/10">
                <Shield className="h-7 w-7 text-pw-blue" strokeWidth={1.5} />
              </div>
              <h1 className="text-[20px] font-bold text-pw-navy">Buddy uitnodiging</h1>
              <p className="mt-2 text-[13px] text-pw-muted">
                Je bent uitgenodigd als buddy op PayWatch. Log in of maak een account aan om de uitnodiging te accepteren.
              </p>
              <button onClick={handleLogin}
                className="btn-press mt-6 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white">
                <LogIn className="h-4 w-4" strokeWidth={1.5} />
                Inloggen / Registreren
              </button>
              <p className="mt-3 text-[11px] text-pw-muted">
                Code: <span className="font-mono font-semibold">{params.code}</span>
              </p>
            </>
          )}

          {/* Ready to accept */}
          {status === 'ready' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pw-blue/10">
                <Shield className="h-7 w-7 text-pw-blue" strokeWidth={1.5} />
              </div>
              <h1 className="text-[20px] font-bold text-pw-navy">Buddy uitnodiging</h1>
              <p className="mt-2 text-[13px] text-pw-muted leading-relaxed">
                Iemand nodigt je uit als buddy op PayWatch. Als buddy kun je hun voortgang volgen en krijg je een melding als een rekening naar incasso escaleert.
              </p>
              <div className="mt-5 rounded-card bg-pw-bg border border-pw-border p-3 text-left">
                <p className="text-[11px] font-semibold text-pw-muted uppercase tracking-wider mb-2">Wat kun je zien?</p>
                <div className="space-y-1.5">
                  <p className="text-[12px] text-pw-text flex items-center gap-2"><Check className="h-3 w-3 text-pw-green flex-shrink-0" strokeWidth={2} /> Overzicht van openstaande schulden</p>
                  <p className="text-[12px] text-pw-text flex items-center gap-2"><Check className="h-3 w-3 text-pw-green flex-shrink-0" strokeWidth={2} /> Meldingen bij incasso-escalaties</p>
                  <p className="text-[12px] text-pw-text flex items-center gap-2"><AlertTriangle className="h-3 w-3 text-pw-muted flex-shrink-0" strokeWidth={1.5} /> Alleen rekeningen in incasso/deurwaarder</p>
                </div>
              </div>
              <button onClick={handleAccept}
                className="btn-press mt-5 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white">
                <Shield className="h-4 w-4" strokeWidth={1.5} />
                Uitnodiging accepteren
              </button>
            </>
          )}

          {/* Accepting */}
          {status === 'accepting' && (
            <>
              <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-pw-blue" strokeWidth={1.5} />
              <p className="text-[14px] font-semibold text-pw-navy">Uitnodiging accepteren...</p>
            </>
          )}

          {/* Accepted */}
          {status === 'accepted' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pw-green/10">
                <Check className="h-7 w-7 text-pw-green" strokeWidth={1.5} />
              </div>
              <h1 className="text-[20px] font-bold text-pw-navy">Geaccepteerd!</h1>
              <p className="mt-2 text-[13px] text-pw-muted">
                Je bent nu buddy. Je kunt het dashboard bekijken vanuit je instellingen.
              </p>
              <button onClick={() => router.push('/overzicht')}
                className="btn-press mt-5 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white">
                Naar dashboard
              </button>
            </>
          )}

          {/* Error */}
          {status === 'error' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pw-red/10">
                <AlertTriangle className="h-7 w-7 text-pw-red" strokeWidth={1.5} />
              </div>
              <h1 className="text-[20px] font-bold text-pw-navy">Oeps</h1>
              <p className="mt-2 text-[13px] text-pw-red">{error}</p>
              <button onClick={() => setStatus('ready')}
                className="btn-press mt-5 flex w-full items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[14px] font-semibold text-pw-text">
                Probeer opnieuw
              </button>
            </>
          )}
        </div>

        {/* PayWatch branding */}
        <p className="mt-6 text-center text-[11px] text-pw-muted">
          PayWatch — Nooit meer verrast door een incassobureau
        </p>
      </div>
    </div>
  );
}
