'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Loader2, Check, AlertTriangle, Sparkles, Info, RotateCcw,
  Bell, Monitor, Clock, ArrowRight, Zap, Heart, Target, Eye,
  Shield, Lightbulb, Compass, Leaf,
} from 'lucide-react';

interface ScanProgressProps {
  accountId: string;
  provider?: 'gmail' | 'outlook';
  language?: 'nl' | 'en';
  onComplete: () => void;
  onCancel: () => void;
}

interface Quote {
  text: { nl: string; en: string };
  Icon: React.ElementType;
}

const QUOTES: Quote[] = [
  { text: { nl: 'Financiële rust begint met overzicht.', en: 'Financial peace starts with overview.' }, Icon: Eye },
  { text: { nl: 'Elke betaalde rekening is een stap vooruit.', en: 'Every paid bill is a step forward.' }, Icon: ArrowRight },
  { text: { nl: 'Je bent al bezig — dat is het belangrijkste.', en: 'You\'re already on it — that\'s what matters.' }, Icon: Zap },
  { text: { nl: 'Schulden voorkomen is beter dan genezen.', en: 'Preventing debt is better than curing it.' }, Icon: Shield },
  { text: { nl: 'Kleine stappen, groot resultaat.', en: 'Small steps, big results.' }, Icon: Leaf },
  { text: { nl: 'Je financiën onder controle = rust in je hoofd.', en: 'Finances under control = peace of mind.' }, Icon: Compass },
  { text: { nl: 'Kennis is macht. Overzicht is rust.', en: 'Knowledge is power. Overview is calm.' }, Icon: Lightbulb },
  { text: { nl: 'Iedere reis begint met een eerste stap.', en: 'Every journey starts with a first step.' }, Icon: Target },
  { text: { nl: 'Je toekomstige zelf zal je dankbaar zijn.', en: 'Your future self will thank you.' }, Icon: Heart },
  { text: { nl: 'Grip op je geld = grip op je leven.', en: 'Control your money = control your life.' }, Icon: Target },
];

const MAX_EMAILS = 200;

function detectLanguage(): 'nl' | 'en' {
  if (typeof document === 'undefined') return 'nl';
  const cookie = document.cookie.match(/paywatch-locale=(nl|en)/);
  return (cookie?.[1] as 'nl' | 'en') || 'nl';
}

export default function ScanProgress({ accountId, provider = 'gmail', language, onComplete, onCancel }: ScanProgressProps) {
  const lang = language || detectLanguage();
  const isNl = lang === 'nl';

  const [status, setStatus] = useState<'info' | 'resuming' | 'scanning' | 'done' | 'error'>('info');
  const [processed, setProcessed] = useState(0);
  const [maxEmails, setMaxEmails] = useState(MAX_EMAILS);
  const [totalBillsFound, setTotalBillsFound] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [backgroundRunning, setBackgroundRunning] = useState(false);
  const [displayEstimate, setDisplayEstimate] = useState<string | null>(null);

  const totalProcessedRef = useRef(0);
  const totalBillsRef = useRef(0);
  const abortRef = useRef(false);
  const scanningRef = useRef(false);
  const pageTokenRef = useRef<string | null>(null);

  // ─── Smoothed rate tracking ────────────────────────────────
  // Instead of recalculating from overall elapsed/processed (which jumps
  // wildly when fast keyword-filtered batches alternate with slow AI batches),
  // we track a smoothed rate using exponential moving average.
  const smoothedRateRef = useRef<number | null>(null); // emails per second
  const lastBatchTimeRef = useRef<number>(Date.now());
  const lastBatchProcessedRef = useRef<number>(0);

  // ─── Rotate quotes ─────────────────────────────────────────
  useEffect(() => {
    if (status !== 'scanning') return;
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setQuoteIdx((prev) => (prev + 1) % QUOTES.length);
        setFadeIn(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, [status]);

  // ─── Check for interrupted scan on mount ───────────────────
  useEffect(() => {
    if (provider !== 'outlook') return;
    async function checkResume() {
      try {
        const res = await fetch(`/api/scan/outlook/status?accountId=${accountId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.is_active && data.scan_progress > 0) {
          totalProcessedRef.current = data.scan_progress;
          setProcessed(data.scan_progress);
          if (data.is_background) {
            setStatus('scanning');
            setBackgroundRunning(true);
          } else {
            setStatus('resuming');
          }
        }
      } catch { /* status endpoint unavailable */ }
    }
    checkResume();
  }, [accountId, provider]);

  // ─── Poll status when background chain is running ──────────
  useEffect(() => {
    if (!backgroundRunning || status !== 'scanning') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan/outlook/status?accountId=${accountId}`);
        if (!res.ok) return;
        const data = await res.json();
        totalProcessedRef.current = data.scan_progress || totalProcessedRef.current;
        setProcessed(data.scan_progress || 0);
        if (!data.is_active && data.full_scan_complete) {
          setStatus('done');
          setBackgroundRunning(false);
          clearInterval(interval);
        }
      } catch { /* keep polling */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [backgroundRunning, status, accountId]);

  // ─── Smoothed time estimate ────────────────────────────────
  // Called after each batch completes. Uses exponential moving average
  // so the displayed time changes gradually instead of jumping 2s → 3min → 5s.
  const updateEstimate = useCallback((currentProcessed: number, currentMax: number) => {
    const now = Date.now();
    const batchElapsed = (now - lastBatchTimeRef.current) / 1000;
    const batchEmails = currentProcessed - lastBatchProcessedRef.current;

    // Update tracking refs
    lastBatchTimeRef.current = now;
    lastBatchProcessedRef.current = currentProcessed;

    // Need at least 1 email in batch and reasonable time to calculate rate
    if (batchEmails <= 0 || batchElapsed < 0.1) return;

    const batchRate = batchEmails / batchElapsed; // emails per second

    // Exponential moving average: blend 70% previous + 30% new
    // This prevents the estimate from swinging wildly between fast (keyword-filtered)
    // and slow (AI-processed) batches.
    const SMOOTHING = 0.3;
    if (smoothedRateRef.current === null) {
      smoothedRateRef.current = batchRate;
    } else {
      smoothedRateRef.current = smoothedRateRef.current * (1 - SMOOTHING) + batchRate * SMOOTHING;
    }

    const remaining = currentMax - currentProcessed;
    if (remaining <= 0 || currentProcessed < 3) {
      setDisplayEstimate(null);
      return;
    }

    const secondsLeft = Math.ceil(remaining / smoothedRateRef.current);

    // Clamp to reasonable range (5s to 10min)
    const clamped = Math.max(5, Math.min(600, secondsLeft));

    if (clamped < 60) {
      setDisplayEstimate(`~${Math.round(clamped / 5) * 5}s`); // Round to nearest 5s
    } else {
      const mins = Math.ceil(clamped / 60);
      setDisplayEstimate(`~${mins} min`);
    }
  }, []);

  // ─── Run a scan batch ──────────────────────────────────────
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
          body: JSON.stringify({ accountId, batchSize: 15, isDailyScan: false }),
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
          setErrorMessage(isNl
            ? 'Je account moet opnieuw verbonden worden.'
            : 'Your account needs to be reconnected.');
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
        if (data.locked) {
          setBackgroundRunning(true);
          scanningRef.current = false;
          return;
        }
        totalProcessedRef.current = data.scan_progress || (totalProcessedRef.current + (data.processed || 0));
        totalBillsRef.current = totalBillsRef.current + (data.bills_found || 0);
        const currentMax = data.max_emails || maxEmails;
        if (data.max_emails) setMaxEmails(data.max_emails);
        setProcessed(totalProcessedRef.current);
        setTotalBillsFound(totalBillsRef.current);

        // Update smoothed estimate
        updateEstimate(totalProcessedRef.current, currentMax);

        if (data.complete) {
          setStatus('done');
          scanningRef.current = false;
          return;
        }
        scanningRef.current = false;
        if (!abortRef.current) setTimeout(() => runBatch(), 800);
      } else {
        if (data.timeout) {
          scanningRef.current = false;
          if (!abortRef.current) setTimeout(() => runBatch(), 1000);
          return;
        }
        totalProcessedRef.current = data.total_processed || (totalProcessedRef.current + (data.processed || 0));
        totalBillsRef.current = totalBillsRef.current + (data.bills_found || 0);
        const currentMax = data.max_emails || maxEmails;
        if (data.max_emails) setMaxEmails(data.max_emails);
        setProcessed(totalProcessedRef.current);
        setTotalBillsFound(totalBillsRef.current);

        // Update smoothed estimate
        updateEstimate(totalProcessedRef.current, currentMax);

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
      setErrorMessage(isNl ? 'Netwerkfout. Controleer je internetverbinding.' : 'Network error. Check your connection.');
      scanningRef.current = false;
    }
  }, [accountId, provider, startTime, isNl, maxEmails, updateEstimate]);

  const startScan = useCallback(() => {
    abortRef.current = false;
    scanningRef.current = false;
    smoothedRateRef.current = null;
    lastBatchTimeRef.current = Date.now();
    lastBatchProcessedRef.current = 0;
    setDisplayEstimate(null);
    setStatus('scanning');
    setStartTime(Date.now());
    runBatch();
  }, [runBatch]);

  const resumeScan = useCallback(() => {
    abortRef.current = false;
    scanningRef.current = false;
    smoothedRateRef.current = null;
    lastBatchTimeRef.current = Date.now();
    lastBatchProcessedRef.current = totalProcessedRef.current;
    setDisplayEstimate(null);
    setStatus('scanning');
    setStartTime(Date.now());
    runBatch();
  }, [runBatch]);

  const progressPercent = Math.min((processed / maxEmails) * 100, 98);
  const currentQuote = QUOTES[quoteIdx];
  const providerName = provider === 'outlook' ? 'Outlook' : 'Gmail';

  return (
    <div className="space-y-5">

      {/* ─── Info screen ─── */}
      {status === 'info' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-pw-blue/20 bg-gradient-to-br from-pw-blue/5 via-white to-pw-green/5 p-5">
            <div className="flex items-start gap-3 mb-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-pw-blue" strokeWidth={1.5} />
              <div>
                <p className="text-[15px] font-semibold text-pw-navy mb-2">
                  {isNl ? `${providerName} inbox scannen` : `Scan ${providerName} inbox`}
                </p>
                <div className="space-y-3 text-[13px] text-pw-muted leading-relaxed">
                  <p>
                    {isNl
                      ? <>We scannen je e-mails van de <strong>laatste 7 dagen</strong> (maximaal {MAX_EMAILS} e-mails). Dit duurt meestal <strong>2-5 minuten</strong>.</>
                      : <>We&apos;ll scan your emails from the <strong>last 7 days</strong> (up to {MAX_EMAILS} emails). This usually takes <strong>2-5 minutes</strong>.</>}
                  </p>
                  <div className="flex items-start gap-2">
                    <Monitor className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-blue/60" strokeWidth={1.5} />
                    <p>
                      {isNl
                        ? <><strong>Je kunt de app verlaten</strong> tijdens het scannen. De scan gaat door op de server en je krijgt een melding als het klaar is.</>
                        : <><strong>You can leave the app</strong> while scanning. The scan continues on the server and you&apos;ll get a notification when it&apos;s done.</>}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 text-[12px] text-pw-muted/70">
                    <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pw-muted/40" strokeWidth={1.5} />
                    <p>
                      {isNl
                        ? <>Na deze eerste scan scannen we automatisch <strong>elke dag</strong> de laatste 24 uur. Je hoeft hier niks voor te doen.</>
                        : <>After this first scan, we automatically scan the <strong>last 24 hours every day</strong>. No action needed on your end.</>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={startScan} className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
              {isNl ? 'Start scan' : 'Start scan'}
            </button>
            <button onClick={onCancel} className="btn-press rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted">
              {isNl ? 'Annuleren' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Resume interrupted scan ─── */}
      {status === 'resuming' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-pw-amber/20 bg-gradient-to-br from-pw-amber/5 via-white to-pw-blue/5 p-5">
            <div className="flex items-start gap-3 mb-3">
              <RotateCcw className="mt-0.5 h-5 w-5 flex-shrink-0 text-pw-amber" strokeWidth={1.5} />
              <div>
                <p className="text-[15px] font-semibold text-pw-navy mb-2">
                  {isNl ? 'Scan hervatten' : 'Resume scan'}
                </p>
                <p className="text-[13px] text-pw-muted leading-relaxed">
                  {isNl
                    ? <>Je vorige scan is gestopt bij <strong>{processed} e-mails</strong>. We gaan verder waar je gebleven bent.</>
                    : <>Your previous scan stopped at <strong>{processed} emails</strong>. We&apos;ll continue where you left off.</>}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={resumeScan} className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
              {isNl ? 'Hervat scan' : 'Resume scan'}
            </button>
            <button
              onClick={() => { totalProcessedRef.current = 0; totalBillsRef.current = 0; setProcessed(0); setTotalBillsFound(0); startScan(); }}
              className="btn-press rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted"
            >
              {isNl ? 'Opnieuw' : 'Restart'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Scanning ─── */}
      {status === 'scanning' && (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between text-[12px] font-semibold">
              <span className="text-pw-blue">
                {processed} / {maxEmails} {isNl ? 'e-mails' : 'emails'}
              </span>
              <span className="text-pw-green">
                {totalBillsFound} {isNl ? 'rekeningen gevonden' : 'bills found'}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pw-blue to-blue-400 transition-all duration-700 ease-out"
                style={{ width: `${processed > 0 ? progressPercent : 2}%` }}
              />
            </div>
            {displayEstimate && !backgroundRunning && (
              <p className="mt-1 text-[11px] text-pw-muted">
                {isNl ? 'Geschatte resterende tijd:' : 'Estimated time remaining:'} {displayEstimate}
              </p>
            )}
          </div>

          {/* Quote card */}
          <div className="rounded-2xl border border-pw-blue/10 bg-gradient-to-br from-pw-blue/5 via-white to-pw-green/5 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-pw-blue/60" strokeWidth={1.5} />
              <div className={`transition-opacity duration-400 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center gap-2">
                  <currentQuote.Icon className="h-4 w-4 text-pw-blue/40" strokeWidth={1.5} />
                  <p className="text-[15px] font-semibold leading-relaxed text-pw-navy">
                    {currentQuote.text[lang]}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-pw-blue/50" strokeWidth={2} />
              <span className="text-[11px] font-medium text-pw-muted">
                {backgroundRunning
                  ? (isNl ? 'Scan draait op de server — je kunt de app sluiten' : 'Scan is running on the server — you can close the app')
                  : (isNl ? `${providerName} inbox wordt gescand...` : `Scanning ${providerName} inbox...`)
                }
              </span>
            </div>
          </div>

          {/* Background info */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-pw-muted/60">
            <Bell className="h-3 w-3" strokeWidth={1.5} />
            <p>
              {isNl
                ? 'Je kunt de app verlaten — de scan gaat door op de server. Je krijgt een melding als het klaar is.'
                : 'You can leave the app — the scan continues on the server. You\'ll get a notification when it\'s done.'}
            </p>
          </div>

          <button
            onClick={() => { abortRef.current = true; onCancel(); }}
            className="text-[13px] font-semibold text-pw-muted hover:text-pw-text"
          >
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
        </>
      )}

      {/* ─── Done ─── */}
      {status === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-green">
              {isNl ? 'Scan voltooid!' : 'Scan complete!'}
            </span>
          </div>
          <p className="text-[13px] text-pw-muted">
            {isNl
              ? `${processed} e-mails gescand, ${totalBillsFound} rekeningen gevonden.`
              : `${processed} emails scanned, ${totalBillsFound} bills found.`}
          </p>

          <div className="rounded-xl border border-pw-border bg-pw-bg p-3">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pw-green" strokeWidth={1.5} />
              <p className="text-[12px] text-pw-muted">
                {isNl
                  ? <>Vanaf nu scannen we automatisch <strong>elke dag</strong> je inbox. Je hoeft dit niet meer handmatig te doen.</>
                  : <>From now on, we automatically scan your inbox <strong>every day</strong>. No need to do this manually anymore.</>}
              </p>
            </div>
          </div>

          <button onClick={onComplete} className="btn-press w-full rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
            {isNl ? 'Bekijk je rekeningen' : 'View your bills'}
          </button>
        </div>
      )}

      {/* ─── Error ─── */}
      {status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-pw-red" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-red">
              {isNl ? 'Er ging iets mis' : 'Something went wrong'}
            </span>
          </div>
          <p className="text-[13px] text-pw-muted">
            {errorMessage || (isNl ? 'Er ging iets mis bij het scannen.' : 'Something went wrong during the scan.')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setStatus('info'); setErrorMessage(null); scanningRef.current = false; abortRef.current = false; }}
              className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              {isNl ? 'Opnieuw proberen' : 'Try again'}
            </button>
            <button onClick={onCancel} className="btn-press flex-1 rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted">
              {isNl ? 'Annuleren' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
