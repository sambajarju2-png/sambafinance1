'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Shield, Check, Loader2, AlertTriangle, Eye, Bell, Lock } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  partner: 'Partner',
  ouder: 'Ouder',
  schuldhulpmaatje: 'Schuldhulpmaatje',
  anders: 'Buddy',
};

export default function BuddyAcceptPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState<'loading' | 'invite' | 'accepting' | 'accepted' | 'error' | 'expired'>('loading');
  const [error, setError] = useState('');
  const [inviterName, setInviterName] = useState('');
  const [inviterFirstName, setInviterFirstName] = useState('');
  const [role, setRole] = useState('partner');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [autoAccepting, setAutoAccepting] = useState(false);

  const fetchInviteInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/buddy/invite?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        setInviterName(data.inviter_name || '');
        setInviterFirstName(data.inviter_first_name || '');
        setRole(data.role || 'partner');
        return 'ok';
      } else if (res.status === 410) {
        return 'expired';
      } else if (res.status === 404) {
        return 'not_found';
      }
      return 'error';
    } catch {
      return 'error';
    }
  }, [code]);

  useEffect(() => {
    async function load() {
      // 1. Fetch invite info (public, no auth needed)
      const inviteResult = await fetchInviteInfo();

      if (inviteResult === 'expired') {
        setStatus('expired');
        return;
      }
      if (inviteResult === 'not_found') {
        setStatus('error');
        setError('Uitnodiging niet gevonden of verlopen');
        return;
      }

      // 2. Check auth status silently
      try {
        const res = await fetch('/api/settings/profile');
        if (res.status !== 401) {
          setIsLoggedIn(true);
        }
      } catch { /* not logged in */ }

      // 3. Check if returning from login with pending accept
      const pending = sessionStorage.getItem('buddy-invite-code');
      if (pending === code) {
        sessionStorage.removeItem('buddy-invite-code');
        setStatus('invite');
        setAutoAccepting(true);
        return;
      }

      setStatus('invite');
    }
    load();
  }, [code, fetchInviteInfo]);

  // Auto-accept after returning from login
  useEffect(() => {
    if (autoAccepting && status === 'invite' && isLoggedIn) {
      const timer = setTimeout(() => doAccept(), 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAccepting, status, isLoggedIn]);

  async function doAccept() {
    setStatus('accepting');
    setError('');
    try {
      const res = await fetch('/api/buddies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code }),
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

  function handleAccept() {
    if (!isLoggedIn) {
      // Save code and redirect to login
      sessionStorage.setItem('buddy-invite-code', code);
      router.push('/auth/login');
      return;
    }
    doAccept();
  }

  const displayName = inviterName || 'Iemand';
  const displayFirstName = inviterFirstName || displayName.split(' ')[0];
  const initials = displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
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

          {/* Invite — shown first, regardless of auth */}
          {status === 'invite' && (
            <>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pw-blue/10 text-[18px] font-extrabold text-pw-blue"
                style={{ boxShadow: '0 0 0 3px var(--surface), 0 0 0 5px rgba(37,99,235,0.2)' }}>
                {initials}
              </div>
              <h1 className="text-[20px] font-bold text-pw-navy">
                {displayFirstName} nodigt je uit
              </h1>
              <p className="mt-2 text-[13px] text-pw-muted leading-relaxed">
                <span className="font-semibold text-pw-text">{displayName}</span> wil je toevoegen als <span className="font-semibold text-pw-text">{roleLabel}</span> op PayWatch.
              </p>

              {/* What buddies see */}
              <div className="mt-5 rounded-card bg-pw-bg border border-pw-border p-3.5 text-left">
                <p className="text-[11px] font-semibold text-pw-muted uppercase tracking-wider mb-2.5">Als buddy kun je:</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pw-blue/10 flex-shrink-0">
                      <Eye className="h-3.5 w-3.5 text-pw-blue" strokeWidth={1.5} />
                    </div>
                    <p className="text-[12px] text-pw-text">Overzicht van openstaande schulden bekijken</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pw-blue/10 flex-shrink-0">
                      <Bell className="h-3.5 w-3.5 text-pw-blue" strokeWidth={1.5} />
                    </div>
                    <p className="text-[12px] text-pw-text">Melding ontvangen bij incasso-escalaties</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pw-green/10 flex-shrink-0">
                      <Lock className="h-3.5 w-3.5 text-pw-green" strokeWidth={1.5} />
                    </div>
                    <p className="text-[12px] text-pw-text">Alleen-lezen — je kunt niets wijzigen</p>
                  </div>
                </div>
              </div>

              <button onClick={handleAccept}
                className="btn-press mt-5 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3.5 text-[14px] font-semibold text-white">
                <Shield className="h-4 w-4" strokeWidth={1.5} />
                Accepteer uitnodiging
              </button>

              {!isLoggedIn && (
                <p className="mt-3 text-[11px] text-pw-muted">
                  Je wordt gevraagd om in te loggen of een account aan te maken
                </p>
              )}
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
              <h1 className="text-[20px] font-bold text-pw-navy">Je bent nu buddy van {displayFirstName}!</h1>
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
              <button onClick={() => { setStatus('loading'); location.reload(); }}
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
