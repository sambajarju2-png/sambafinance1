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
  const totalProcessedRef = useRef(0);
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
          total_processed: totalProcessedRef.current,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        if (data.needs_reauth) {
          setStatus('error');
          setErrorMessage(t('needsReauth'));
          scanningRef.current = false;
          return;
        }

        setStatus('error');
        setErrorMessage(data.error || `Server error (${res.status})`);
        scanningRef.current = false;
        return;
      }

      const data = await res.json();

      // Handle timeout (200 with timeout flag — just retry)
      if (data.timeout) {
        scanningRef.current = false;
        if (!abortRef.current) {
          setTimeout(() => runBatch(), 1000);
        }
        return;
      }

      // Update counters
      const batchProcessed = data.processed || 0;
      const batchBills = data.bills_found || 0;

      totalProcessedRef.current = data.total_processed || (totalProcessedRef.current + batchProcessed);
      setProcessed(totalProcessedRef.current);
      setBillsFound((prev) => prev + batchBills);

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
        setTimeout(() => runBatch(), 800);
      }
    } catch (err) {
      console.error('Scan batch error:', err);
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
      {/* Scanning */}
      {status === 'scanning' && (
        <div className="space-y-3">
          {/* Animated bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-pw-blue transition-all duration-500"
              style={{ width: processed > 0
                ? `${Math.min((processed / 40) * 100, 95)}%`
                : '5%' }}
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
          <p className="text-[13px] text-pw-muted">{errorMessage || t('errorGeneral')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setStatus('scanning');
                setErrorMessage(null);
                scanningRef.current = false;
                runBatch();
              }}
              className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              {t('retry')}
            </button>
            <button
              onClick={onCancel}
              className="btn-press flex-1 rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
