'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, Check, Loader2, RefreshCw, Link2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface CalendarStatus {
  connected: boolean;
  email?: string | null;
  sync_enabled?: boolean;
  needs_reauth?: boolean;
  last_synced_at?: string | null;
  synced_count?: number;
}

export default function CalendarSettings() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/status');
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    const s = searchParams.get('status');
    if (searchParams.get('tab') !== 'calendar' || !s) return;
    if (s === 'connected') {
      setMessage({ type: 'success', text: 'Google Agenda gekoppeld. Je openstaande betalingen staan nu in je agenda.' });
      fetchStatus();
    } else if (s === 'denied') {
      setMessage({ type: 'error', text: 'Koppeling geannuleerd.' });
    } else if (s === 'error') {
      setMessage({ type: 'error', text: 'Er ging iets mis bij het koppelen. Probeer het opnieuw.' });
    }
    // Clear the OAuth params so a refresh does not re-show this message.
    window.history.replaceState(null, '', '/instellingen');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleConnect() {
    setConnecting(true);
    setMessage(null);
    try {
      let isNative = false;
      try {
        const { Capacitor } = await import('@capacitor/core');
        isNative = Capacitor.isNativePlatform();
      } catch { /* web */ }

      const res = await fetch('/api/calendar/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ native: isNative }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: d.error || 'Kon niet koppelen.' });
        setConnecting(false);
        return;
      }
      const { url } = await res.json();
      if (isNative) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url, presentationStyle: 'popover' });
        const handler = await Browser.addListener('browserFinished', () => {
          handler.remove();
          setConnecting(false);
          fetchStatus();
        });
      } else {
        window.location.href = url;
      }
    } catch {
      setMessage({ type: 'error', text: 'Kon niet koppelen.' });
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: 'success', text: 'Agenda bijgewerkt.' });
        fetchStatus();
      } else if (d.error === 'reauth') {
        setMessage({ type: 'error', text: 'Koppeling verlopen. Koppel Google Agenda opnieuw.' });
      } else {
        setMessage({ type: 'error', text: 'Synchroniseren mislukt.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Synchroniseren mislukt.' });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Google Agenda ontkoppelen? De PayWatch-agenda en alle afspraken worden verwijderd.')) return;
    setDisconnecting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/calendar/disconnect', { method: 'POST' });
      if (res.ok) {
        setStatus({ connected: false });
        setMessage({ type: 'success', text: 'Google Agenda ontkoppeld.' });
      } else {
        setMessage({ type: 'error', text: 'Ontkoppelen mislukt.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Ontkoppelen mislukt.' });
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = status?.connected;

  return (
    <div className="space-y-4">
      <p className="text-sm text-pw-muted">
        Zet je openstaande betalingen automatisch in je Google Agenda. Betaal je een rekening, dan verdwijnt de
        afspraak vanzelf.
      </p>

      {message && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-2xl border border-pw-border bg-pw-surface p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-pw-blue/10">
            <Calendar className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-pw-text">Google Agenda</p>
            {loading ? (
              <p className="mt-0.5 text-[12px] text-pw-muted">Laden...</p>
            ) : connected ? (
              <p className="mt-0.5 truncate text-[12px] text-pw-muted">{status?.email || 'Gekoppeld'}</p>
            ) : (
              <p className="mt-0.5 text-[12px] text-pw-muted">Nog niet gekoppeld</p>
            )}

            {connected && !loading && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-pw-muted">
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-600" strokeWidth={2} />
                  {status?.synced_count || 0} betalingen in agenda
                </span>
                {status?.last_synced_at && (
                  <span>
                    Bijgewerkt{' '}
                    {new Date(status.last_synced_at).toLocaleString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            )}
          </div>

          {!connected && !loading && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-pw-blue px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" strokeWidth={1.5} />}
              Koppelen
            </button>
          )}
        </div>

        {connected && status?.needs_reauth && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
            Koppeling verlopen. Koppel Google Agenda opnieuw om te blijven synchroniseren.
          </div>
        )}

        {connected && !loading && (
          <div className="mt-3 flex items-center gap-2 border-t border-pw-border pt-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-pw-border px-3 py-1.5 text-[12px] font-semibold text-pw-text disabled:opacity-50"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />}
              Nu synchroniseren
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="ml-auto text-[12px] font-semibold text-pw-red disabled:opacity-50"
            >
              {disconnecting ? 'Bezig...' : 'Ontkoppelen'}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-pw-bg px-4 py-3 text-[12px] text-pw-muted">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-pw-blue" strokeWidth={1.5} />
        <span>
          Privacy: in je agenda staat alleen &quot;Betaling via PayWatch&quot; met een link naar de app. Geen bedragen,
          geen bedrijfsnamen. PayWatch maakt een aparte agenda aan en kan alleen daarin afspraken zien of wijzigen, niet
          in je andere agenda&apos;s.
        </span>
      </div>
    </div>
  );
}
