'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Check, AlertTriangle } from 'lucide-react';

interface ScanProgressProps {
  accountId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ScanProgress({ accountId, onComplete, onCancel }: ScanProgressProps) {
  const t = useTranslations('scan');

  const [status, setStatus] = useState<'scanning' | 'done' | 'error'>('scanning');
  const [processed, setProcessed] = useState(0);
  const [billsFound, setBillsFound] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pageTokenRef = useRef<string | null>(null);
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

      // Update counters
      setProcessed((prev) => prev + (data.processed || 0));
      setBillsFound((prev) => prev + (data.bills_found || 0));

      if (data.done) {
        setStatus('done');
        scanningRef.current = false;
        return;
      }

      // More to scan — store page token and continue
      pageTokenRef.current = data.page_token || null;
      scanningRef.current = false;

      // Auto-trigger next batch after a small delay
      if (!abortRef.current) {
        setTimeout(() => runBatch(), 500);
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(t('errorNetwork'));
      scanningRef.current = false;
    }
  }, [accountId, t]);

  // Start scanning on mount
  useEffect(() => {
    runBatch();
    return () => {
      abortRef.current = true;
    };
  }, [runBatch]);

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      {status === 'scanning' && (
        <div className="space-y-3">
          {/* Animated bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-pw-blue transition-all duration-500"
              style={{ width: processed > 0 ? `${Math.min((processed / Math.max(processed + 50, 100)) * 100, 95)}%` : '5%' }}
            />
          </div>

          {/* Counters */}
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-pw-blue" strokeWidth={1.5} />
            <span className="text-[14px] font-medium text-pw-muted">
              {t('scanning', { count: processed })}
            </span>
          </div>

          {billsFound > 0 && (
            <p className="text-[14px] font-semibold text-pw-green">
              {t('billsFound', { count: billsFound })}
            </p>
          )}

          {/* Cancel button */}
          <button
            onClick={() => {
              abortRef.current = true;
              onCancel();
            }}
            className="text-[13px] font-semibold text-pw-muted hover:text-pw-text"
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {/* Done */}
      {status === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-green">
              {t('complete')}
            </span>
          </div>

          <p className="text-[13px] text-pw-muted">
            {t('summary', { processed, bills: billsFound })}
          </p>

          <button
            onClick={onComplete}
            className="btn-press w-full rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            {t('done')}
          </button>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-pw-red" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-red">
              {t('errorTitle')}
            </span>
          </div>

          <p className="text-[13px] text-pw-muted">
            {errorMessage || t('errorGeneral')}
          </p>

          {processed > 0 && (
            <p className="text-[13px] text-pw-muted">
              {t('partialSummary', { processed, bills: billsFound })}
            </p>
          )}

          <button
            onClick={onCancel}
            className="btn-press w-full rounded-button border border-pw-border bg-pw-surface px-4 py-2.5 text-[13px] font-semibold text-pw-text"
          >
            {t('close')}
          </button>
        </div>
      )}
    </div>
  );
}
