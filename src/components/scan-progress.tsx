'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Check, AlertTriangle, Sparkles } from 'lucide-react';

interface ScanProgressProps {
  accountId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const QUOTES_NL = [
  { text: 'Financiële rust begint met overzicht.', emoji: '🧘' },
  { text: 'Elke betaalde rekening is een stap vooruit.', emoji: '🚶' },
  { text: 'Je bent al bezig — dat is het belangrijkste.', emoji: '💪' },
  { text: 'Schulden voorkomen is beter dan genezen.', emoji: '🛡️' },
  { text: 'Kleine stappen, groot resultaat.', emoji: '🌱' },
  { text: 'Je financiën onder controle = rust in je hoofd.', emoji: '☁️' },
  { text: 'Kennis is macht. Overzicht is rust.', emoji: '📊' },
  { text: 'Iedere reis begint met een eerste stap.', emoji: '✨' },
  { text: 'Je toekomstige zelf zal je dankbaar zijn.', emoji: '🙏' },
  { text: 'Grip op je geld = grip op je leven.', emoji: '🎯' },
  { text: 'Ademen. Overzicht krijgen. Actie nemen.', emoji: '🌊' },
  { text: 'Een helder overzicht is het halve werk.', emoji: '📋' },
];

export default function ScanProgress({ accountId, onComplete, onCancel }: ScanProgressProps) {
  const t = useTranslations('scan');

  const [status, setStatus] = useState<'scanning' | 'done' | 'error'>('scanning');
  const [processed, setProcessed] = useState(0);
  const [maxEmails, setMaxEmails] = useState(100);
  const [billsFound, setBillsFound] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  const pageTokenRef = useRef<string | null>(null);
  const totalProcessedRef = useRef(0);
  const abortRef = useRef(false);
  const scanningRef = useRef(false);

  // Rotate quotes with fade animation
  useEffect(() => {
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setQuoteIdx((prev) => (prev + 1) % QUOTES_NL.length);
        setFadeIn(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
        if (data.needs_reauth) { setStatus('error'); setErrorMessage(t('needsReauth')); scanningRef.current = false; return; }
        setStatus('error'); setErrorMessage(data.error || `Error (${res.status})`); scanningRef.current = false; return;
      }

      const data = await res.json();
      if (data.timeout) { scanningRef.current = false; if (!abortRef.current) setTimeout(() => runBatch(), 1000); return; }

      totalProcessedRef.current = data.total_processed || (totalProcessedRef.current + (data.processed || 0));
      if (data.max_emails) setMaxEmails(data.max_emails);
      setProcessed(totalProcessedRef.current);
      setBillsFound((prev) => prev + (data.bills_found || 0));

      if (data.done) { setStatus('done'); scanningRef.current = false; return; }

      pageTokenRef.current = data.page_token || null;
      scanningRef.current = false;
      if (!abortRef.current) setTimeout(() => runBatch(), 600);
    } catch {
      setStatus('error'); setErrorMessage(t('errorNetwork')); scanningRef.current = false;
    }
  }, [accountId, t]);

  useEffect(() => { runBatch(); return () => { abortRef.current = true; }; }, [runBatch]);

  const progressPercent = Math.min((processed / maxEmails) * 100, 98);
  const currentQuote = QUOTES_NL[quoteIdx];

  return (
    <div className="space-y-5">
      {status === 'scanning' && (
        <>
          {/* Progress bar */}
          <div>
            <div className="mb-2 flex items-center justify-between text-[12px] font-semibold">
              <span className="text-pw-blue">{processed} / {maxEmails} e-mails</span>
              <span className="text-pw-green">{billsFound} rekeningen gevonden</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pw-blue to-blue-400 transition-all duration-700 ease-out"
                style={{ width: `${processed > 0 ? progressPercent : 2}%` }}
              />
            </div>
          </div>

          {/* Animated quote card */}
          <div className="rounded-2xl border border-pw-blue/10 bg-gradient-to-br from-pw-blue/5 via-white to-pw-green/5 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-pw-blue/60" strokeWidth={1.5} />
              <div className={`transition-opacity duration-400 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
                <p className="text-[15px] font-semibold leading-relaxed text-pw-navy">
                  {currentQuote.emoji} {currentQuote.text}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-pw-blue/50" strokeWidth={2} />
              <span className="text-[11px] font-medium text-pw-muted">Inbox wordt gescand...</span>
            </div>
          </div>

          <button
            onClick={() => { abortRef.current = true; onCancel(); }}
            className="text-[13px] font-semibold text-pw-muted hover:text-pw-text"
          >
            {t('cancel')}
          </button>
        </>
      )}

      {status === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-green">{t('complete')}</span>
          </div>
          <p className="text-[13px] text-pw-muted">{t('summary', { processed, bills: billsFound })}</p>
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
          <div className="flex gap-3">
            <button onClick={() => { setStatus('scanning'); setErrorMessage(null); scanningRef.current = false; runBatch(); }}
              className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">{t('retry')}</button>
            <button onClick={onCancel} className="btn-press flex-1 rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted">{t('cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
