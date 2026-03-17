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
} from 'lucide-react';
import ScanProgress from '@/components/scan-progress';

interface GmailAccount {
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

  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [scanningAccountId, setScanningAccountId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch {
      console.error('Failed to fetch Gmail accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    const status = searchParams.get('status');
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
  }, [searchParams, t, fetchAccounts]);

  async function handleConnect() {
    setConnecting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/gmail/connect', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setStatusMessage({ type: 'error', text: data.error || t('errorGeneral') });
        setConnecting(false);
        return;
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setStatusMessage({ type: 'error', text: t('errorGeneral') });
      setConnecting(false);
    }
  }

  async function handleDisconnect(accountId: string) {
    if (!confirm(t('disconnectConfirm'))) return;

    setDisconnecting(accountId);

    try {
      const res = await fetch('/api/gmail/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });

      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
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

  // If currently scanning, show scan progress
  if (scanningAccountId) {
    return (
      <div className="space-y-4">
        <h2 className="text-heading-sm text-pw-navy">{t('scanTitle')}</h2>
        <ScanProgress
          accountId={scanningAccountId}
          onComplete={() => {
            setScanningAccountId(null);
            fetchAccounts();
          }}
          onCancel={() => {
            setScanningAccountId(null);
            fetchAccounts();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-heading-sm text-pw-navy">{t('title')}</h2>
      <p className="text-[13px] text-pw-muted">{t('description')}</p>

      {/* Status message */}
      {statusMessage && (
        <div
          className={`flex items-center gap-2 rounded-input px-3 py-2.5 ${
            statusMessage.type === 'success'
              ? 'border border-green-200 bg-green-50'
              : 'border border-red-200 bg-red-50'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <Check className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
          ) : (
            <AlertTriangle className="h-4 w-4 text-pw-red" strokeWidth={1.5} />
          )}
          <p
            className={`text-label ${
              statusMessage.type === 'success' ? 'text-pw-green' : 'text-pw-red'
            }`}
          >
            {statusMessage.text}
          </p>
        </div>
      )}

      {/* Connected accounts */}
      {loading ? (
        <div className="skeleton h-[68px] rounded-card" />
      ) : accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-card border border-pw-border bg-pw-surface px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-input bg-pw-blue/10">
                  <Mail className="h-[18px] w-[18px] text-pw-blue" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-pw-text">{account.email}</p>
                  <p className="text-[11px] text-pw-muted">
                    {account.needs_reauth
                      ? t('needsReauth')
                      : account.last_scanned
                      ? `${t('lastScanned')}: ${new Date(account.last_scanned).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : t('neverScanned')}
                  </p>
                </div>

                {account.needs_reauth && (
                  <button
                    onClick={handleConnect}
                    className="flex-shrink-0 rounded-button bg-pw-amber/10 px-2 py-1 text-[11px] font-semibold text-pw-amber"
                  >
                    <RefreshCw className="mr-1 inline h-3 w-3" strokeWidth={1.5} />
                    {t('reauth')}
                  </button>
                )}

                <button
                  onClick={() => handleDisconnect(account.id)}
                  disabled={disconnecting === account.id}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-button text-pw-muted hover:bg-red-50 hover:text-pw-red disabled:opacity-50"
                >
                  {disconnecting === account.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>

              {/* Scan button */}
              {!account.needs_reauth && (
                <button
                  onClick={() => setScanningAccountId(account.id)}
                  className="btn-press mt-3 flex w-full items-center justify-center gap-2 rounded-button border border-pw-blue/30 bg-pw-blue/5 px-4 py-2.5 text-[13px] font-semibold text-pw-blue transition-colors hover:bg-pw-blue/10"
                >
                  <Search className="h-4 w-4" strokeWidth={1.5} />
                  {account.full_scan_complete ? t('scanAgain') : t('startScan')}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-card border border-dashed border-pw-border bg-pw-surface py-8 text-center">
          <Mail className="mb-3 h-10 w-10 text-pw-muted/40" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-pw-text">{t('noAccounts')}</p>
          <p className="mt-1 max-w-[260px] text-[11px] text-pw-muted">{t('noAccountsHint')}</p>
        </div>
      )}

      {/* Connect button */}
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {connecting ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        )}
        {t('connectGmail')}
      </button>
    </div>
  );
}
