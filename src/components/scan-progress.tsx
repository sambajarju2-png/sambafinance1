'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Check, AlertTriangle, Sparkles, Info, RotateCcw } from 'lucide-react';

interface ScanProgressProps {
  accountId: string;
  provider?: 'gmail' | 'outlook';
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

const MAX_EMAILS = 200; // Must match server-side limit

export default function ScanProgress({ accountId, provider = 'gmail', onComplete, onCancel }: ScanProgressProps) {
  const [status, setStatus] = useState<'info' | 'scanning' | 'resuming' | 'done' | 'error'>('info');
  const [processed, setProcessed] = useState(0);
  const [maxEmails, setMaxEmails] = useState(MAX_EMAILS);
  const [billsFound, setBillsFound] = useState(0);
  const [totalBillsFound, setTotalBillsFound] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(null);

  const totalProcessedRef = useRef(0);
  const totalBillsRef = useRef(0);
  const abortRef = useRef(false);
  const scanningRef = useRef(false);
  const pageTokenRef = useRef<string | null>(null);

  // Rotate quotes
  useEffect(() => {
    if (status !== 'scanning' && status !== 'resuming') return;
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setQuoteIdx((prev) => (prev + 1) % QUOTES_NL.length);
        setFadeIn(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, [status]);

  // ─── Check for interrupted scan on mount ───────────────────
  useEffect(() => {
    async function checkResume() {
      try {
        const res = await fetch(`/api/scan/outlook/status?accountId=${accountId}`);
        if (res.ok) {
          const data = await res.json();
          // If there's a saved cursor and progress, offer to resume
          if (data.scan_cursor && data.scan_progress > 0) {
            totalProcessedRef.current = data.scan_progress;
            setProcessed(data.scan_progress);
            setStatus('resuming');
            return;
          }
        }
      } catch {
        // Status endpoint might not exist yet — that's fine, just show info screen
      }
    }
    if (provider === 'outlook') {
      checkResume();
    }
  }, [accountId, provider]);

  // ─── Estimated time calculation ────────────────────────────
  const getEstimatedTime = () => {
    if (!startTime || processed < 5) return null;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    const remaining = maxEmails - processed;
    const secondsLeft = Math.ceil(remaining / rate);
    if (secondsLeft < 60) return `~${secondsLeft}s`;
    return `~${Math.ceil(secondsLeft / 60)} min`;
  };

  // ─── Tab visibility: track when user leaves/returns ────────
  useEffect(() => {
    if (status !== 'scanning') return;

    const handleVisibility = () => {
      if (document.hidden) {
        // User switched away — scan keeps running as long as tab stays alive
        // The server will send a push notification via sw.js when complete
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [status]);

  const runBatch = useCallback(async () => {
    if (abortRef.current || scanningRef.current) return;
    scanningRef.current = true;

    if (!startTime) setStartTime(Date.now());

    try {
      let res: Response;

      if (provider === 'outlook') {
        res = await fetch('/api/scan/outlook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            batchSize: 15,
            isDailyScan: false,
          }),
        });
      } else {
        res = await fetch('/api/gmail/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: accountId,
            page_token: pageTokenRef.current,
            total_processed: totalProcessedRef.current,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.needs_reauth) {
          setStatus('error');
          setErrorMessage('Je Outlook-account moet opnieuw verbonden worden.');
          scanningRef.current = false;
          return;
        }
        setStatus('error');
        setErrorMessage(data.error || `Error (${res.status})`);
        scanningRef.current = false;
        return;
      }

      const data = await res.json();

      if (provider === 'outlook') {
        totalProcessedRef.current = data.scan_progress || (totalProcessedRef.current + (data.processed || 0));
        totalBillsRef.current = totalBillsRef.current + (data.bills_found || 0);
        if (data.max_emails) setMaxEmails(data.max_emails);
        setProcessed(totalProcessedRef.current);
        setBillsFound(data.bills_found || 0);
        setTotalBillsFound(totalBillsRef.current);

        if (data.complete) {
          setStatus('done');
          scanningRef.current = false;
          // Push notification is sent server-side via sendPushToUser
          // Browser Notification API as fallback for same-tab
          return;
        }

        scanningRef.current = false;
        if (!abortRef.current) setTimeout(() => runBatch(), 600);
      } else {
        // Gmail response format
        if (data.timeout) {
          scanningRef.current = false;
          if (!abortRef.current) setTimeout(() => runBatch(), 1000);
          return;
        }

        totalProcessedRef.current = data.total_processed || (totalProcessedRef.current + (data.processed || 0));
        totalBillsRef.current = totalBillsRef.current + (data.bills_found || 0);
        if (data.max_emails) setMaxEmails(data.max_emails);
        setProcessed(totalProcessedRef.current);
        setBillsFound(data.bills_found || 0);
        setTotalBillsFound(totalBillsRef.current);

        if (data.done) {
          setStatus('done');
          scanningRef.current = false;
          return;
        }

        pageTokenRef.current = data.page_token || null;
        scanningRef.current = false;
        if (!abortRef.current) setTimeout(() => runBatch(), 600);
      }
    } catch {
      setStatus('error');
      setErrorMessage('Netwerkfout. Controleer je internetverbinding.');
      scanningRef.current = false;
    }
  }, [accountId, provider, startTime]);

  const startScan = useCallback(() => {
    abortRef.current = false;
    setStatus('scanning');
    setStartTime(Date.now());
    runBatch();
  }, [runBatch]);

  const resumeScan = useCallback(() => {
    abortRef.current = false;
    setStatus('scanning');
    setStartTime(Date.now());
    runBatch();
  }, [runBatch]);

  const progressPercent = Math.min((processed / maxEmails) * 100, 98);
  const currentQuote = QUOTES_NL[quoteIdx];
  const estimatedTime = getEstimatedTime();

  return (
    <div className="space-y-5">
      {/* ─── Step 1: Info screen (before scan starts) ─── */}
      {status === 'info' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-pw-blue/20 bg-gradient-to-br from-pw-blue/5 via-white to-pw-green/5 p-5">
            <div className="flex items-start gap-3 mb-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-pw-blue" strokeWidth={1.5} />
              <div>
                <p className="text-[15px] font-semibold text-pw-navy mb-2">
                  {provider === 'outlook' ? 'Outlook inbox scannen' : 'Gmail inbox scannen'}
                </p>
                <div className="space-y-2 text-[13px] text-pw-muted leading-relaxed">
                  <p>
                    We scannen je e-mails van de <strong>laatste 7 dagen</strong> (maximaal {MAX_EMAILS} e-mails).
                    Dit duurt meestal <strong>2-5 minuten</strong>.
                  </p>
                  <p>
                    💡 <strong>Houd dit tabblad open</strong> tijdens het scannen. Je mag gerust andere tabs gebruiken — we sturen een melding als het klaar is.
                  </p>
                  <p className="text-[12px] text-pw-muted/70 pt-1">
                    Na deze eerste scan scannen we automatisch <strong>elke dag</strong> de laatste 24 uur. Je hoeft hier niks voor te doen.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={startScan}
              className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              Start scan
            </button>
            <button
              onClick={onCancel}
              className="btn-press rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* ─── Resume: interrupted scan detected ─── */}
      {status === 'resuming' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-pw-amber/20 bg-gradient-to-br from-pw-amber/5 via-white to-pw-blue/5 p-5">
            <div className="flex items-start gap-3 mb-3">
              <RotateCcw className="mt-0.5 h-5 w-5 flex-shrink-0 text-pw-amber" strokeWidth={1.5} />
              <div>
                <p className="text-[15px] font-semibold text-pw-navy mb-2">
                  Scan hervatten
                </p>
                <div className="space-y-2 text-[13px] text-pw-muted leading-relaxed">
                  <p>
                    Je vorige scan is gestopt bij <strong>{processed} e-mails</strong>. We kunnen verdergaan waar je gebleven bent.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resumeScan}
              className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              Hervat scan
            </button>
            <button
              onClick={() => {
                totalProcessedRef.current = 0;
                setProcessed(0);
                startScan();
              }}
              className="btn-press rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted"
            >
              Opnieuw
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Scanning ─── */}
      {status === 'scanning' && (
        <>
          {/* Progress bar */}
          <div>
            <div className="mb-2 flex items-center justify-between text-[12px] font-semibold">
              <span className="text-pw-blue">{processed} / {maxEmails} e-mails</span>
              <span className="text-pw-green">{totalBillsFound} rekeningen gevonden</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pw-blue to-blue-400 transition-all duration-700 ease-out"
                style={{ width: `${processed > 0 ? progressPercent : 2}%` }}
              />
            </div>
            {estimatedTime && (
              <p className="mt-1 text-[11px] text-pw-muted">
                Geschatte resterende tijd: {estimatedTime}
              </p>
            )}
          </div>

          {/* Quote card */}
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
              <span className="text-[11px] font-medium text-pw-muted">
                {provider === 'outlook' ? 'Outlook' : 'Gmail'} inbox wordt gescand...
              </span>
            </div>
          </div>

          {/* Honest background info */}
          <p className="text-[11px] text-pw-muted/60 text-center">
            💡 Houd dit tabblad open. Je kunt andere tabs gebruiken — je krijgt een melding als het klaar is.
          </p>

          <button
            onClick={() => { abortRef.current = true; onCancel(); }}
            className="text-[13px] font-semibold text-pw-muted hover:text-pw-text"
          >
            Annuleren
          </button>
        </>
      )}

      {/* ─── Step 3: Done ─── */}
      {status === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-green">Scan voltooid!</span>
          </div>
          <p className="text-[13px] text-pw-muted">
            {processed} e-mails gescand, {totalBillsFound} rekeningen gevonden.
          </p>

          {/* Daily scan explanation */}
          <div className="rounded-xl border border-pw-border bg-pw-bg p-3">
            <p className="text-[12px] text-pw-muted">
              ✅ Vanaf nu scannen we automatisch <strong>elke dag</strong> je inbox.
              Je hoeft dit niet meer handmatig te doen.
            </p>
          </div>

          <button onClick={onComplete} className="btn-press w-full rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
            Bekijk je rekeningen
          </button>
        </div>
      )}

      {/* ─── Error ─── */}
      {status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-pw-red" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-red">Er ging iets mis</span>
          </div>
          <p className="text-[13px] text-pw-muted">{errorMessage || 'Er ging iets mis bij het scannen.'}</p>
          <div className="flex gap-3">
            <button onClick={() => { setStatus('info'); setErrorMessage(null); scanningRef.current = false; abortRef.current = false; }}
              className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">Opnieuw proberen</button>
            <button onClick={onCancel} className="btn-press flex-1 rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted">Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}
