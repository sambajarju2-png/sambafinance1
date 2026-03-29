'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Mail,
  Plus,
  Trash2,
  Loader2,
  Check,
  AlertTriangle,
  RefreshCw,
  Search,
  Cloud,
} from 'lucide-react';
import ScanProgress from '@/components/scan-progress';

interface EmailAccount {
  id: string;
  email: string;
  last_scanned: string | null;
  scan_progress: number;
  full_scan_complete: boolean;
  needs_reauth: boolean;
  created_at: string;
}

export default function GmailSettings() {
  const t = useTranslations('gmail');
  const searchParams = useSearchParams();

  const [gmailAccounts, setGmailAccounts] = useState<EmailAccount[]>([]);
  const [outlookAccounts, setOutlookAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [connectingOutlook, setConnectingOutlook] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [scanningAccount, setScanningAccount] = useState<{ id: string; provider: 'gmail' | 'outlook' } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const gmailRes = await fetch('/api/gmail/accounts');
      if (gmailRes.ok) {
        const data = await gmailRes.json();
        setGmailAccounts(data.accounts || []);
      }

      const outlookRes = await fetch('/api/outlook/accounts');
      if (outlookRes.ok) {
        const data = await outlookRes.json();
        setOutlookAccounts(data.accounts || []);
      }
    } catch {
      console.error('Failed to fetch email accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  useEffect(() => {
    const status = searchParams.get('status');
    const outlook = searchParams.get('outlook');

    if (status === 'connected') {
      setStatusMessage({ type: 'success', text: t('connected') });
      fetchAccounts();
      window.history.replaceState(null, '', '/instellingen');
    } else if (status === 'denied') {
      setStatusMessage({ type: 'error', text: t('denied') });
      window.history.replaceState(null, '', '/instellingen');
    } else if (status === 'error') {
      setStatusMessage({ type: 'error', text: t('errorGeneral') });
      window.history.replaceState(null, '', '/instellingen');
    }

    if (outlook === 'connected') {
      setStatusMessage({ type: 'success', text: 'Outlook succesvol verbonden!' });
      fetchAccounts();
      window.history.replaceState(null, '', '/instellingen');
    } else if (outlook === 'cancelled') {
      setStatusMessage({ type: 'error', text: 'Outlook verbinding geannuleerd.' });
      window.history.replaceState(null, '', '/instellingen');
    } else if (outlook === 'error') {
      setStatusMessage({ type: 'error', text: 'Er ging iets mis bij het verbinden met Outlook.' });
      window.history.replaceState(null, '', '/instellingen');
    }
  }, [searchParams, t, fetchAccounts]);

  async function handleConnectGmail() {
    setConnectingGmail(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/gmail/connect', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setStatusMessage({ type: 'error', text: data.error || t('errorGeneral') });
        setConnectingGmail(false);
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setStatusMessage({ type: 'error', text: t('errorGeneral') });
      setConnectingGmail(false);
    }
  }

  async function handleConnectOutlook() {
    setConnectingOutlook(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/auth/outlook/connect', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setStatusMessage({ type: 'error', text: data.error || 'Er ging iets mis.' });
        setConnectingOutlook(false);
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setStatusMessage({ type: 'error', text: 'Er ging iets mis bij het verbinden met Outlook.' });
      setConnectingOutlook(false);
    }
  }

  async function handleDisconnectGmail(accountId: string) {
    if (!confirm(t('disconnectConfirm'))) return;
    setDisconnecting(accountId);
    try {
      const res = await fetch('/api/gmail/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });
      if (res.ok) {
        setGmailAccounts((prev) => prev.filter((a) => a.id !== accountId));
        setStatusMessage({ type: 'success', text: t('disconnected') });
      } else {
        setStatusMessage({ type: 'error', text: t('errorGeneral') });
      }
    } catch {
      setStatusMessage({ type: 'error', text: t('errorGeneral') });
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleDisconnectOutlook(accountId: string) {
    if (!confirm('Weet je zeker dat je dit Outlook account wilt ontkoppelen?')) return;
    setDisconnecting(accountId);
    try {
      const res = await fetch('/api/auth/outlook/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (res.ok) {
        setOutlookAccounts((prev) => prev.filter((a) => a.id !== accountId));
        setStatusMessage({ type: 'success', text: 'Outlook account ontkoppeld.' });
      } else {
        setStatusMessage({ type: 'error', text: 'Kon account niet ontkoppelen.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Er ging iets mis.' });
    } finally {
      setDisconnecting(null);
    }
  }

  // If currently scanning, show scan progress with the right provider
  if (scanningAccount) {
    return (
      <div className="space-y-4">
        <h2 className="text-heading-sm text-pw-navy">
          {scanningAccount.provider === 'outlook' ? 'Outlook scan' : t('scanTitle')}
        </h2>
        <ScanProgress
          accountId={scanningAccount.id}
          provider={scanningAccount.provider}
          onComplete={() => { setScanningAccount(null); fetchAccounts(); }}
          onCancel={() => { setScanningAccount(null); fetchAccounts(); }}
        />
      </div>
    );
  }

  const hasAnyAccounts = gmailAccounts.length > 0 || outlookAccounts.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-heading-sm text-pw-navy">E-mail accounts</h2>
        <p className="text-[13px] text-pw-muted mt-1">
          Verbind je e-mail om automatisch rekeningen te detecteren uit je inbox.
        </p>
        <p className="text-[11px] text-pw-muted/70 mt-1.5">
          We gebruiken je inbox alleen om rekeningen te herkennen. We lezen, bewaren of delen geen andere e-mails.{' '}
          <a href="https://paywatch.app/privacy" target="_blank" rel="noopener noreferrer" className="text-pw-blue hover:underline">Privacybeleid</a>
        </p>
      </div>

      {statusMessage && (
        <div className={`flex items-center gap-2 rounded-input px-3 py-2.5 ${
          statusMessage.type === 'success' ? 'border border-green-200 bg-green-50' : 'border border-red-200 bg-red-50'
        }`}>
          {statusMessage.type === 'success' ? (
            <Check className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
          ) : (
            <AlertTriangle className="h-4 w-4 text-pw-red" strokeWidth={1.5} />
          )}
          <p className={`text-label ${statusMessage.type === 'success' ? 'text-pw-green' : 'text-pw-red'}`}>
            {statusMessage.text}
          </p>
        </div>
      )}

      {!loading && !hasAnyAccounts && (
        <div className="flex flex-col items-center rounded-card border border-dashed border-pw-border bg-pw-surface py-8 text-center">
          <Mail className="mb-3 h-10 w-10 text-pw-muted/40" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-pw-text">Geen e-mail accounts verbonden</p>
          <p className="mt-1 max-w-[260px] text-[11px] text-pw-muted">
            Verbind Gmail of Outlook om automatisch rekeningen uit je inbox te halen.
          </p>
        </div>
      )}

      {/* Gmail Section */}
      {(gmailAccounts.length > 0 || loading) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-red-100">
              <Mail className="h-3 w-3 text-red-600" strokeWidth={2} />
            </div>
            <p className="text-[12px] font-bold text-pw-muted uppercase tracking-wide">Gmail</p>
          </div>
          {loading ? (
            <div className="skeleton h-[68px] rounded-card" />
          ) : (
            gmailAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                provider="gmail"
                onReauth={handleConnectGmail}
                onDisconnect={() => handleDisconnectGmail(account.id)}
                onScan={() => setScanningAccount({ id: account.id, provider: 'gmail' })}
                disconnecting={disconnecting === account.id}
              />
            ))
          )}
        </div>
      )}

      {/* Outlook Section */}
      {outlookAccounts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-100">
              <Cloud className="h-3 w-3 text-blue-600" strokeWidth={2} />
            </div>
            <p className="text-[12px] font-bold text-pw-muted uppercase tracking-wide">Outlook / Hotmail</p>
          </div>
          {outlookAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              provider="outlook"
              onReauth={handleConnectOutlook}
              onDisconnect={() => handleDisconnectOutlook(account.id)}
              onScan={() => setScanningAccount({ id: account.id, provider: 'outlook' })}
              disconnecting={disconnecting === account.id}
            />
          ))}
        </div>
      )}

      {/* Connect Buttons */}
      <div className="space-y-2">
        <button
          onClick={handleConnectGmail}
          disabled={connectingGmail}
          className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {connectingGmail ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
          Gmail verbinden
        </button>
        <button
          onClick={handleConnectOutlook}
          disabled={connectingOutlook}
          className="btn-press flex w-full items-center justify-center gap-2 rounded-button border-2 border-pw-blue px-4 py-3 text-[13px] font-semibold text-pw-blue transition-colors hover:bg-pw-blue/5 disabled:opacity-50"
        >
          {connectingOutlook ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
          Outlook / Hotmail verbinden
        </button>
      </div>
    </div>
  );
}

/* ── Account Card ── */
interface AccountCardProps {
  account: EmailAccount;
  provider: 'gmail' | 'outlook';
  onReauth: () => void;
  onDisconnect: () => void;
  onScan: () => void;
  disconnecting: boolean;
}

function AccountCard({ account, provider, onReauth, onDisconnect, onScan, disconnecting }: AccountCardProps) {
  const iconBg = provider === 'gmail' ? 'bg-red-50' : 'bg-blue-50';
  const iconColor = provider === 'gmail' ? 'text-red-500' : 'text-blue-500';
  const Icon = provider === 'gmail' ? Mail : Cloud;

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-input ${iconBg}`}>
          <Icon className={`h-[18px] w-[18px] ${iconColor}`} strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-pw-text">{account.email}</p>
          <p className="text-[11px] text-pw-muted">
            {account.needs_reauth
              ? 'Opnieuw verbinden vereist'
              : account.last_scanned
              ? `Laatst gescand: ${new Date(account.last_scanned).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Nog niet gescand'}
          </p>
        </div>

        {account.needs_reauth && (
          <button
            onClick={onReauth}
            className="flex-shrink-0 rounded-button bg-pw-amber/10 px-2 py-1 text-[11px] font-semibold text-pw-amber"
          >
            <RefreshCw className="mr-1 inline h-3 w-3" strokeWidth={1.5} />
            Opnieuw verbinden
          </button>
        )}

        <button
          onClick={onDisconnect}
          disabled={disconnecting}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-button text-pw-muted hover:bg-red-50 hover:text-pw-red disabled:opacity-50"
        >
          {disconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {!account.needs_reauth && (
        <button
          onClick={onScan}
          className="btn-press mt-3 flex w-full items-center justify-center gap-2 rounded-button border border-pw-blue/30 bg-pw-blue/5 px-4 py-2.5 text-[13px] font-semibold text-pw-blue transition-colors hover:bg-pw-blue/10"
        >
          <Search className="h-4 w-4" strokeWidth={1.5} />
          {account.full_scan_complete ? 'Opnieuw scannen' : 'Start scan'}
        </button>
      )}
    </div>
  );
}
