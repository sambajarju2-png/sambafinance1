'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2, RefreshCw, Unlink, ChevronRight, Loader2, Search,
  Check, AlertCircle, Clock, X, Shield
} from 'lucide-react';

interface Institution {
  id: string;
  name: string;
  logo: string;
  max_history_days: string;
}

interface BankAccount {
  account_id: string;
  connection_id: string;
  institution_name: string;
  institution_logo: string;
  iban: string;
  owner_name: string;
  balance: { amount: number; currency: string; date: string } | null;
  status: string;
  last_synced: string | null;
  valid_until: string | null;
}

interface Connection {
  id: string;
  institution_name: string;
  institution_logo: string;
  status: string;
  account_count: number;
  last_synced: string | null;
  valid_until: string | null;
  error: string | null;
}

interface SyncResult {
  success: boolean;
  new_transactions: number;
  matched: number;
}

export default function BankConnectCard() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/accounts');
      const data = await res.json();
      setConnections(data.connections || []);
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  async function handleSync(connectionId?: string) {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/bank/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionId ? { connection_id: connectionId } : {})
      });
      const data = await res.json();
      setSyncResult(data);
      await fetchAccounts(); // refresh balances
    } catch {
      setSyncResult({ success: false, new_transactions: 0, matched: 0 });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect(connectionId: string) {
    if (!confirm('Weet je zeker dat je deze bankverbinding wilt verwijderen? Alle opgehaalde transacties worden ook verwijderd.')) return;
    setDisconnecting(connectionId);
    try {
      await fetch('/api/bank/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId })
      });
      await fetchAccounts();
    } catch (err) {
      console.error('Disconnect failed:', err);
    } finally {
      setDisconnecting(null);
    }
  }

  const linkedConnections = connections.filter(c => c.status === 'linked');
  const hasConnections = linkedConnections.length > 0;

  return (
    <div className="space-y-4">
      {/* Connected accounts */}
      {loading ? (
        <div className="rounded-card border border-pw-border bg-pw-surface p-6">
          <div className="flex items-center justify-center gap-2 text-pw-muted">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            <span className="text-[13px]">Bankgegevens laden...</span>
          </div>
        </div>
      ) : hasConnections ? (
        <>
          {accounts.map(account => (
            <div key={account.account_id} className="rounded-card border border-pw-border bg-pw-surface p-4">
              <div className="flex items-start gap-3">
                {account.institution_logo ? (
                  <img src={account.institution_logo} alt={account.institution_name} className="h-10 w-10 rounded-lg object-contain bg-white border border-pw-border/50 p-1" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pw-blue/10">
                    <Building2 className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-pw-navy">{account.institution_name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      <Check className="h-3 w-3" strokeWidth={2} />
                      Gekoppeld
                    </span>
                  </div>
                  <p className="text-[12px] text-pw-muted font-mono mt-0.5">{account.iban}</p>
                  {account.owner_name && (
                    <p className="text-[11px] text-pw-muted mt-0.5">{account.owner_name}</p>
                  )}
                  {account.balance && (
                    <p className="text-[16px] font-bold text-pw-navy mt-2">
                      {account.balance.currency === 'EUR' ? '€' : account.balance.currency}{' '}
                      {(account.balance.amount / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  {account.last_synced && (
                    <p className="text-[10px] text-pw-muted mt-1">
                      Laatst gesynchroniseerd: {new Date(account.last_synced).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t border-pw-border/50">
                <button
                  onClick={() => handleSync(account.connection_id)}
                  disabled={syncing}
                  className="btn-press flex-1 flex items-center justify-center gap-1.5 rounded-button bg-pw-blue px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  {syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  Synchroniseren
                </button>
                <button
                  onClick={() => handleDisconnect(account.connection_id)}
                  disabled={disconnecting === account.connection_id}
                  className="btn-press flex items-center justify-center gap-1.5 rounded-button border border-pw-border bg-white px-3 py-2 text-[12px] font-semibold text-pw-red hover:bg-red-50 disabled:opacity-50"
                >
                  {disconnecting === account.connection_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Unlink className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  Ontkoppel
                </button>
              </div>
            </div>
          ))}

          {/* Sync result toast */}
          {syncResult && (
            <div className={`rounded-card border p-3 ${syncResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <p className={`text-[12px] font-medium ${syncResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {syncResult.success
                  ? `${syncResult.new_transactions} nieuwe transacties opgehaald, ${syncResult.matched} automatisch gematcht`
                  : 'Synchronisatie mislukt. Probeer het later opnieuw.'
                }
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-card border border-pw-border bg-pw-surface p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-pw-blue/10">
            <Building2 className="h-6 w-6 text-pw-blue" strokeWidth={1.5} />
          </div>
          <h3 className="text-[14px] font-semibold text-pw-navy mb-1">Koppel je bankrekening</h3>
          <p className="text-[12px] text-pw-muted leading-relaxed max-w-[280px] mx-auto">
            Verbind je bank zodat PayWatch automatisch kan zien welke vaste lasten betaald zijn.
          </p>
        </div>
      )}

      {/* Pending connections */}
      {connections.filter(c => c.status === 'pending').map(conn => (
        <div key={conn.id} className="rounded-card border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" strokeWidth={1.5} />
              <p className="text-[12px] font-medium text-yellow-700">
                {conn.institution_name} — Wacht op autorisatie
              </p>
            </div>
            <button
              onClick={() => handleDisconnect(conn.id)}
              disabled={disconnecting === conn.id}
              className="text-[11px] font-medium text-yellow-700 hover:text-red-600 transition-colors"
            >
              {disconnecting === conn.id ? '...' : 'Annuleer'}
            </button>
          </div>
        </div>
      ))}

      {/* Error connections */}
      {connections.filter(c => c.status === 'error' || c.status === 'expired').map(conn => (
        <div key={conn.id} className="rounded-card border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" strokeWidth={1.5} />
              <p className="text-[12px] font-medium text-red-700">
                {conn.institution_name} — {conn.error || (conn.status === 'expired' ? 'Verlopen' : 'Fout')}
              </p>
            </div>
            <button
              onClick={() => handleDisconnect(conn.id)}
              className="text-[11px] text-red-500 hover:underline"
            >
              Verwijder
            </button>
          </div>
        </div>
      ))}

      {/* Add bank button */}
      <button
        onClick={() => setShowBankSelector(true)}
        className="btn-press flex w-full items-center justify-center gap-2 rounded-button border border-dashed border-pw-blue/30 bg-pw-blue/5 px-4 py-3 text-[13px] font-semibold text-pw-blue transition-colors hover:bg-pw-blue/10"
      >
        <Building2 className="h-4 w-4" strokeWidth={1.5} />
        {hasConnections ? 'Nog een bank toevoegen' : 'Bank koppelen'}
      </button>

      {/* Info text */}
      <div className="rounded-card border border-pw-border/50 bg-pw-bg p-3">
        <div className="flex gap-2">
          <Shield className="h-4 w-4 text-pw-blue shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="text-[11px] text-pw-muted leading-relaxed">
              PayWatch gebruikt open banking (PSD2) via Enable Banking om veilig je transacties op te halen.
              We kunnen nooit geld overmaken of je saldo wijzigen — alleen meelezen.
              Verbindingen verlopen automatisch na 90 dagen.
            </p>
          </div>
        </div>
      </div>

      {/* Bank selector modal */}
      {showBankSelector && (
        <BankSelectorModal onClose={() => setShowBankSelector(false)} />
      )}
    </div>
  );
}

// ─── Bank Selector Modal ─────────────────────────────────────

function BankSelectorModal({ onClose }: { onClose: () => void }) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bank/institutions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setInstitutions(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Kon banken niet laden');
        setLoading(false);
      });
  }, []);

  async function handleSelect(inst: Institution) {
    setConnecting(inst.id);
    setError(null);
    try {
      const res = await fetch('/api/bank/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: inst.id,
          institution_name: inst.name,
          institution_logo: inst.logo
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Kon bankverbinding niet starten');
        setConnecting(null);
        return;
      }

      // Open bank authorization page
      // Native: use SFSafariViewController (dismissible overlay)
      // Web: direct navigation
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: data.link, presentationStyle: 'popover' });
          // When user closes the browser, refresh connections
          Browser.addListener('browserFinished', () => {
            setConnecting(null);
            fetchAccounts();
          });
          return;
        }
      } catch {}
      window.location.href = data.link;
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.');
      setConnecting(null);
    }
  }

  const filtered = institutions.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-[20px] bg-pw-surface shadow-2xl drawer-enter"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-[16px] font-bold text-pw-navy">Kies je bank</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-pw-bg transition-colors">
            <X className="h-5 w-5 text-pw-muted" strokeWidth={1.5} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pw-muted" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Zoek je bank..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-pw-border bg-white pl-9 pr-4 py-2.5 text-[13px] text-pw-text placeholder:text-pw-muted focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
              autoFocus
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-[12px] text-red-700">{error}</p>
          </div>
        )}

        {/* Bank list */}
        <div className="overflow-y-auto px-5 pb-5" style={{ maxHeight: '55vh' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-pw-muted">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              <span className="text-[13px]">Banken laden...</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-[13px] text-pw-muted">
              Geen banken gevonden voor &ldquo;{search}&rdquo;
            </p>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(inst => (
                <button
                  key={inst.id}
                  onClick={() => handleSelect(inst)}
                  disabled={connecting !== null}
                  className="btn-press flex w-full items-center gap-3 rounded-xl border border-pw-border/50 bg-white p-3 transition-colors hover:bg-pw-bg disabled:opacity-50"
                >
                  {inst.logo ? (
                    <img src={inst.logo} alt={inst.name} className="h-9 w-9 rounded-lg object-contain bg-white border border-pw-border/30 p-0.5" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pw-blue/10">
                      <Building2 className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
                    </div>
                  )}
                  <span className="flex-1 text-left text-[13px] font-medium text-pw-navy">{inst.name}</span>
                  {connecting === inst.id ? (
                    <Loader2 className="h-4 w-4 text-pw-blue animate-spin" strokeWidth={1.5} />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
