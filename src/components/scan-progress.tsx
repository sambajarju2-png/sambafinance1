'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Check, AlertTriangle } from 'lucide-react';

const MAX_EMAILS = 20;

interface ScanProgressProps {
  accountId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ScanProgress({ accountId, onComplete, onCancel }: ScanProgressProps) {
  const t = useTranslations('scan');

  const [status, setStatus] = useState<'scanning' | 'done' | 'error'>('scanning');
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [billsFound, setBillsFound] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pageTokenRef = useRef<string | null>(null);
  const totalRef = useRef(0);
  const abortRef = useRef(false);
  const scanningRef = useRef(false);

  const runBatch = useCallback(async () => {
    if (abortRef.current || scanningRef.current) return;
    scanningRef.current = true;

    try {
      const res = await fetch('/api/gmail/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          page_token: pageTokenRef.current,
          total_processed: totalRef.current,
        }),
      });

      const data = await res.json();

      if (data.needs_reauth) {
        setStatus('error');
        setErrorMessage(t('needsReauth'));
        scanningRef.current = false;
        return;
      }

      if (data.error && !data.timeout) {
        setStatus('error');
        setErrorMessage(data.error);
        scanningRef.current = false;
        return;
      }

      const newTotal = data.total_processed || (totalRef.current + (data.processed || 0));
      totalRef.current = newTotal;
      setTotalProcessed(newTotal);
      setBillsFound((prev) => prev + (data.bills_found || 0));

      if (data.done) {
        setStatus('done');
        scanningRef.current = false;
        return;
      }

      pageTokenRef.current = data.page_token || null;
      scanningRef.current = false;

      if (!abortRef.current) {
        setTimeout(() => runBatch(), 800);
      }
    } catch {
      setStatus('error');
      setErrorMessage(t('errorNetwork'));
      scanningRef.current = false;
    }
  }, [accountId, t]);

  useEffect(() => {
    runBatch();
    return () => { abortRef.current = true; };
  }, [runBatch]);

  const progress = Math.min((totalProcessed / MAX_EMAILS) * 100, 100);

  return (
    <div className="space-y-4">
      {status === 'scanning' && (
        <div className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-pw-blue transition-all duration-500"
              style={{ width: `${Math.max(progress, 5)}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-pw-blue" strokeWidth={1.5} />
            <span className="text-[14px] font-medium text-pw-muted">
              {t('scanning', { count: totalProcessed })} ({MAX_EMAILS} max)
            </span>
          </div>
          {billsFound > 0 && (
            <p className="text-[14px] font-semibold text-pw-green">
              {t('billsFound', { count: billsFound })}
            </p>
          )}
          <button
            onClick={() => { abortRef.current = true; onCancel(); }}
            className="text-[13px] font-semibold text-pw-muted hover:text-pw-text"
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {status === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-green">{t('complete')}</span>
          </div>
          <p className="text-[13px] text-pw-muted">
            {t('summary', { processed: totalProcessed, bills: billsFound })}
          </p>
          <button onClick={onComplete} className="btn-press w-full rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
            {t('done')}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-pw-red" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-red">{t('errorTitle')}</span>
          </div>
          <p className="text-[13px] text-pw-muted">{errorMessage || t('errorGeneral')}</p>
          <button onClick={onCancel} className="btn-press w-full rounded-button border border-pw-border bg-pw-surface px-4 py-2.5 text-[13px] font-semibold text-pw-text">
            {t('close')}
          </button>
        </div>
      )}
    </div>
  );
}
