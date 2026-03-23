'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Check, Loader2, AlertTriangle, LogIn } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  partner: 'Partner',
  ouder: 'Ouder',
  schuldhulpmaatje: 'Schuldhulpmaatje',
  anders: 'Buddy',
};

export default function BuddyAcceptPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'accepted' | 'error' | 'login' | 'expired'>('loading');
  const [error, setError] = useState('');
  const [inviterName, setInviterName] = useState('Iemand');
  const [inviterFirstName, setInviterFirstName] = useState('Iemand');
  const [role, setRole] = useState('partner');

  // Fetch invite info (public — no auth needed)
  useEffect(() => {
    async function loadInvite() {
      try {
        const res = await fetch(`/api/buddy/invite?code=${params.code}`);
        if (res.ok) {
          const data = await res.json();
          setInviterName(data.inviter_name || 'Iemand');
          setInviterFirstName(data.inviter_first_name || 'Iemand');
          setRole(data.role || 'partner');
        } else if (res.status === 410) {
          setStatus('expired');
          setError('Deze uitnodiging is al geaccepteerd');
          return;
        } else if (res.status === 404) {
          setStatus('error');
          setError('Uitnodiging niet gevonden of verlopen');
          return;
        }
      } catch { /* continue — will show generic */ }

      // Check if user is logged in
      try {
        const res = await fetch('/api/settings/profile');
        if (res.status === 401) {
          sessionStorage.setItem('buddy-invite-code', params.code);
          setStatus('login');
          return;
        }
        setStatus('ready');
      } catch {
        setStatus('login');
      }
    }
    loadInvite();
  }, [params.code]);

  // Auto-accept if returning from login
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

  const initials = inviterName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const roleLabel = ROLE_LABELS[role] || 'Buddy';

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
              {/* Avatar */}
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pw-blue/10 text-[18px] font-extrabold text-pw-blue"
                style={{ boxShadow: '0 0 0 3px var(--surface), 0 0 0 5px rgba(37,99,235,0.2)' }}>
                {initials}
              </div>
              <h1 className="text-[20px] font-bold text-pw-navy">
                {inviterFirstName} nodigt je uit
              </h1>
              <p className="mt-2 text-[13px] text-pw-muted leading-relaxed">
                <span className="font-semibold text-pw-text">{inviterName}</span> wil je toevoegen als <span className="font-semibold text-pw-text">{roleLabel}</span> op PayWatch.
                Log in of maak een account aan om te accepteren.
              </p>
              <button onClick={handleLogin}
                className="btn-press mt-6 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white">
                <LogIn className="h-4 w-4" strokeWidth={1.5} />
                Inloggen / Registreren
              </button>
            </>
          )}

          {/* Ready to accept */}
          {status === 'ready' && (
            <>
              {/* Avatar */}
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pw-blue/10 text-[18px] font-extrabold text-pw-blue"
                style={{ boxShadow: '0 0 0 3px var(--surface), 0 0 0 5px rgba(37,99,235,0.2)' }}>
                {initials}
              </div>
              <h1 className="text-[20px] font-bold text-pw-navy">
                {inviterFirstName} nodigt je uit
              </h1>
              <p className="mt-2 text-[13px] text-pw-muted leading-relaxed">
                <span className="font-semibold text-pw-text">{inviterName}</span> wil je toevoegen als <span className="font-semibold text-pw-text">{roleLabel}</span>. Als buddy kun je hun voortgang volgen en krijg je een melding als een rekening naar incasso escaleert.
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
                Accepteer uitnodiging van {inviterFirstName}
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
              <h1 className="text-[20px] font-bold text-pw-navy">Je bent nu buddy van {inviterFirstName}!</h1>
              <p className="mt-2 text-[13px] text-pw-muted">
                Je kunt het dashboard bekijken vanuit je instellingen onder &ldquo;Buddy / Vangnet&rdquo;.
              </p>
              <button onClick={() => router.push('/instellingen?tab=buddy')}
                className="btn-press mt-5 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white">
                Bekijk dashboard
              </button>
            </>
          )}

          {/* Expired */}
          {status === 'expired' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pw-amber/10">
                <AlertTriangle className="h-7 w-7 text-pw-amber" strokeWidth={1.5} />
              </div>
              <h1 className="text-[20px] font-bold text-pw-navy">Al geaccepteerd</h1>
              <p className="mt-2 text-[13px] text-pw-muted">Deze uitnodiging is al gebruikt.</p>
              <button onClick={() => router.push('/overzicht')}
                className="btn-press mt-5 flex w-full items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[14px] font-semibold text-pw-text">
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

        <p className="mt-6 text-center text-[11px] text-pw-muted">
          PayWatch — Nooit meer verrast door een incassobureau
        </p>
      </div>
    </div>
  );
}
