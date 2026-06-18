'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Loader2, Check, AlertTriangle, Sparkles, Info, RotateCcw,
  Bell, Monitor, Clock, ArrowRight, Zap, Heart, Target, Eye,
  Shield, Lightbulb, Compass, Leaf,
} from 'lucide-react';
import { localeFromCookie, pick } from '@/lib/i18n-pick';
import type { Locale } from '@/i18n/locale-meta';

interface ScanProgressProps {
  accountId: string;
  provider?: 'gmail' | 'outlook';
  language?: Locale;
  onComplete: () => void;
  onCancel: () => void;
}

interface Quote {
  text: { nl: string; en: string; pl: string; tr: string };
  Icon: React.ElementType;
}

const QUOTES: Quote[] = [
  { text: { nl: 'Financiële rust begint met overzicht.', en: 'Financial peace starts with overview.', pl: 'Spokój finansowy zaczyna się od przeglądu.', tr: 'Mali huzur, genel bakışla başlar.' }, Icon: Eye },
  { text: { nl: 'Elke betaalde rekening is een stap vooruit.', en: 'Every paid bill is a step forward.', pl: 'Każdy opłacony rachunek to krok naprzód.', tr: 'Ödenen her fatura ileriye bir adımdır.' }, Icon: ArrowRight },
  { text: { nl: 'Je bent al bezig — dat is het belangrijkste.', en: 'You\'re already on it — that\'s what matters.', pl: 'Już działasz — to jest najważniejsze.', tr: 'Şimdiden başladın — en önemlisi bu.' }, Icon: Zap },
  { text: { nl: 'Schulden voorkomen is beter dan genezen.', en: 'Preventing debt is better than curing it.', pl: 'Lepiej zapobiegać długom niż je leczyć.', tr: 'Borcu önlemek, sonra çözmekten iyidir.' }, Icon: Shield },
  { text: { nl: 'Kleine stappen, groot resultaat.', en: 'Small steps, big results.', pl: 'Małe kroki, wielki efekt.', tr: 'Küçük adımlar, büyük sonuç.' }, Icon: Leaf },
  { text: { nl: 'Je financiën onder controle = rust in je hoofd.', en: 'Finances under control = peace of mind.', pl: 'Finanse pod kontrolą = spokój w głowie.', tr: 'Finansın kontrol altında = huzurlu bir zihin.' }, Icon: Compass },
  { text: { nl: 'Kennis is macht. Overzicht is rust.', en: 'Knowledge is power. Overview is calm.', pl: 'Wiedza to potęga. Przegląd to spokój.', tr: 'Bilgi güçtür. Genel bakış huzurdur.' }, Icon: Lightbulb },
  { text: { nl: 'Iedere reis begint met een eerste stap.', en: 'Every journey starts with a first step.', pl: 'Każda podróż zaczyna się od pierwszego kroku.', tr: 'Her yolculuk ilk adımla başlar.' }, Icon: Target },
  { text: { nl: 'Je toekomstige zelf zal je dankbaar zijn.', en: 'Your future self will thank you.', pl: 'Twoje przyszłe ja będzie ci wdzięczne.', tr: 'Gelecekteki sen sana teşekkür edecek.' }, Icon: Heart },
  { text: { nl: 'Grip op je geld = grip op je leven.', en: 'Control your money = control your life.', pl: 'Kontrola nad pieniędzmi = kontrola nad życiem.', tr: 'Paranın kontrolü = hayatının kontrolü.' }, Icon: Target },
];

const MAX_EMAILS = 200;

function detectLanguage(): Locale {
  return localeFromCookie();
}

export default function ScanProgress({ accountId, provider = 'gmail', language, onComplete, onCancel }: ScanProgressProps) {
  const lang = language || detectLanguage();

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
          setErrorMessage(pick(lang, {
            nl: 'Je account moet opnieuw verbonden worden.',
            en: 'Your account needs to be reconnected.',
            pl: 'Twoje konto musi zostać ponownie połączone.',
            tr: 'Hesabının yeniden bağlanması gerekiyor.',
          }));
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
      setErrorMessage(pick(lang, { nl: 'Netwerkfout. Controleer je internetverbinding.', en: 'Network error. Check your connection.', pl: 'Błąd sieci. Sprawdź połączenie z internetem.', tr: 'Ağ hatası. Bağlantını kontrol et.' }));
      scanningRef.current = false;
    }
  }, [accountId, provider, startTime, lang, maxEmails, updateEstimate]);

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
                  {pick(lang, { nl: `${providerName} inbox scannen`, en: `Scan ${providerName} inbox`, pl: `Skanowanie skrzynki ${providerName}`, tr: `${providerName} gelen kutusunu tara` })}
                </p>
                <div className="space-y-3 text-[13px] text-pw-muted leading-relaxed">
                  <p>
                    {pick(lang, {
                      nl: <>We scannen je e-mails van de <strong>laatste 7 dagen</strong> (maximaal {MAX_EMAILS} e-mails). Dit duurt meestal <strong>2-5 minuten</strong>.</>,
                      en: <>We&apos;ll scan your emails from the <strong>last 7 days</strong> (up to {MAX_EMAILS} emails). This usually takes <strong>2-5 minutes</strong>.</>,
                      pl: <>Skanujemy twoje e-maile z <strong>ostatnich 7 dni</strong> (maksymalnie {MAX_EMAILS} e-maili). Zwykle trwa to <strong>2-5 minut</strong>.</>,
                      tr: <>Son <strong>7 güne</strong> ait e-postalarını tararız (en fazla {MAX_EMAILS} e-posta). Bu genellikle <strong>2-5 dakika</strong> sürer.</>,
                    })}
                  </p>
                  <div className="flex items-start gap-2">
                    <Monitor className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-blue/60" strokeWidth={1.5} />
                    <p>
                      {pick(lang, {
                        nl: <><strong>Je kunt de app verlaten</strong> tijdens het scannen. De scan gaat door op de server en je krijgt een melding als het klaar is.</>,
                        en: <><strong>You can leave the app</strong> while scanning. The scan continues on the server and you&apos;ll get a notification when it&apos;s done.</>,
                        pl: <><strong>Możesz opuścić aplikację</strong> podczas skanowania. Skanowanie jest kontynuowane na serwerze, a po zakończeniu otrzymasz powiadomienie.</>,
                        tr: <><strong>Tarama sırasında uygulamadan çıkabilirsin</strong>. Tarama sunucuda devam eder ve bittiğinde bir bildirim alırsın.</>,
                      })}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 text-[12px] text-pw-muted/70">
                    <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pw-muted/40" strokeWidth={1.5} />
                    <p>
                      {pick(lang, {
                        nl: <>Na deze eerste scan scannen we automatisch <strong>elke dag</strong> de laatste 24 uur. Je hoeft hier niks voor te doen.</>,
                        en: <>After this first scan, we automatically scan the <strong>last 24 hours every day</strong>. No action needed on your end.</>,
                        pl: <>Po tym pierwszym skanowaniu automatycznie skanujemy <strong>codziennie</strong> ostatnie 24 godziny. Nie musisz nic robić.</>,
                        tr: <>Bu ilk taramadan sonra her gün <strong>son 24 saati</strong> otomatik tararız. Senin bir şey yapmana gerek yok.</>,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={startScan} className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
              {pick(lang, { nl: 'Start scan', en: 'Start scan', pl: 'Rozpocznij skanowanie', tr: 'Taramayı başlat' })}
            </button>
            <button onClick={onCancel} className="btn-press rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted">
              {pick(lang, { nl: 'Annuleren', en: 'Cancel', pl: 'Anuluj', tr: 'İptal' })}
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
                  {pick(lang, { nl: 'Scan hervatten', en: 'Resume scan', pl: 'Wznów skanowanie', tr: 'Taramayı sürdür' })}
                </p>
                <p className="text-[13px] text-pw-muted leading-relaxed">
                  {pick(lang, {
                    nl: <>Je vorige scan is gestopt bij <strong>{processed} e-mails</strong>. We gaan verder waar je gebleven bent.</>,
                    en: <>Your previous scan stopped at <strong>{processed} emails</strong>. We&apos;ll continue where you left off.</>,
                    pl: <>Twoje poprzednie skanowanie zatrzymało się na <strong>{processed} e-mailach</strong>. Kontynuujemy od miejsca, w którym przerwałeś.</>,
                    tr: <>Önceki taraman <strong>{processed} e-postada</strong> durdu. Kaldığın yerden devam ediyoruz.</>,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={resumeScan} className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
              {pick(lang, { nl: 'Hervat scan', en: 'Resume scan', pl: 'Wznów skanowanie', tr: 'Taramayı sürdür' })}
            </button>
            <button
              onClick={() => { totalProcessedRef.current = 0; totalBillsRef.current = 0; setProcessed(0); setTotalBillsFound(0); startScan(); }}
              className="btn-press rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted"
            >
              {pick(lang, { nl: 'Opnieuw', en: 'Restart', pl: 'Od nowa', tr: 'Yeniden başlat' })}
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
                {processed} / {maxEmails} {pick(lang, { nl: 'e-mails', en: 'emails', pl: 'e-maili', tr: 'e-posta' })}
              </span>
              <span className="text-pw-green">
                {totalBillsFound} {pick(lang, { nl: 'rekeningen gevonden', en: 'bills found', pl: 'znalezionych rachunków', tr: 'fatura bulundu' })}
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
                {pick(lang, { nl: 'Geschatte resterende tijd:', en: 'Estimated time remaining:', pl: 'Szacowany pozostały czas:', tr: 'Tahmini kalan süre:' })} {displayEstimate}
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
                    {pick(lang, currentQuote.text)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-pw-blue/50" strokeWidth={2} />
              <span className="text-[11px] font-medium text-pw-muted">
                {backgroundRunning
                  ? pick(lang, { nl: 'Scan draait op de server — je kunt de app sluiten', en: 'Scan is running on the server — you can close the app', pl: 'Skanowanie działa na serwerze — możesz zamknąć aplikację', tr: 'Tarama sunucuda çalışıyor — uygulamayı kapatabilirsin' })
                  : pick(lang, { nl: `${providerName} inbox wordt gescand...`, en: `Scanning ${providerName} inbox...`, pl: `Skanowanie skrzynki ${providerName}...`, tr: `${providerName} gelen kutusu taranıyor...` })
                }
              </span>
            </div>
          </div>

          {/* Background info */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-pw-muted/60">
            <Bell className="h-3 w-3" strokeWidth={1.5} />
            <p>
              {pick(lang, {
                nl: 'Je kunt de app verlaten — de scan gaat door op de server. Je krijgt een melding als het klaar is.',
                en: 'You can leave the app — the scan continues on the server. You\'ll get a notification when it\'s done.',
                pl: 'Możesz opuścić aplikację — skanowanie jest kontynuowane na serwerze. Otrzymasz powiadomienie, gdy się zakończy.',
                tr: 'Uygulamadan çıkabilirsin — tarama sunucuda devam eder. Bittiğinde bir bildirim alırsın.',
              })}
            </p>
          </div>

          <button
            onClick={() => { abortRef.current = true; onCancel(); }}
            className="text-[13px] font-semibold text-pw-muted hover:text-pw-text"
          >
            {pick(lang, { nl: 'Annuleren', en: 'Cancel', pl: 'Anuluj', tr: 'İptal' })}
          </button>
        </>
      )}

      {/* ─── Done ─── */}
      {status === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-green">
              {pick(lang, { nl: 'Scan voltooid!', en: 'Scan complete!', pl: 'Skanowanie zakończone!', tr: 'Tarama tamamlandı!' })}
            </span>
          </div>
          <p className="text-[13px] text-pw-muted">
            {pick(lang, {
              nl: `${processed} e-mails gescand, ${totalBillsFound} rekeningen gevonden.`,
              en: `${processed} emails scanned, ${totalBillsFound} bills found.`,
              pl: `${processed} e-maili przeskanowanych, ${totalBillsFound} znalezionych rachunków.`,
              tr: `${processed} e-posta tarandı, ${totalBillsFound} fatura bulundu.`,
            })}
          </p>

          <div className="rounded-xl border border-pw-border bg-pw-bg p-3">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pw-green" strokeWidth={1.5} />
              <p className="text-[12px] text-pw-muted">
                {pick(lang, {
                  nl: <>Vanaf nu scannen we automatisch <strong>elke dag</strong> je inbox. Je hoeft dit niet meer handmatig te doen.</>,
                  en: <>From now on, we automatically scan your inbox <strong>every day</strong>. No need to do this manually anymore.</>,
                  pl: <>Od teraz automatycznie skanujemy twoją skrzynkę <strong>codziennie</strong>. Nie musisz już robić tego ręcznie.</>,
                  tr: <>Bundan sonra gelen kutunu <strong>her gün</strong> otomatik tararız. Bunu artık elle yapmana gerek yok.</>,
                })}
              </p>
            </div>
          </div>

          <button onClick={onComplete} className="btn-press w-full rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
            {pick(lang, { nl: 'Bekijk je rekeningen', en: 'View your bills', pl: 'Zobacz swoje rachunki', tr: 'Faturalarını gör' })}
          </button>
        </div>
      )}

      {/* ─── Error ─── */}
      {status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-pw-red" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-pw-red">
              {pick(lang, { nl: 'Er ging iets mis', en: 'Something went wrong', pl: 'Coś poszło nie tak', tr: 'Bir şeyler ters gitti' })}
            </span>
          </div>
          <p className="text-[13px] text-pw-muted">
            {errorMessage || pick(lang, { nl: 'Er ging iets mis bij het scannen.', en: 'Something went wrong during the scan.', pl: 'Coś poszło nie tak podczas skanowania.', tr: 'Tarama sırasında bir şeyler ters gitti.' })}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setStatus('info'); setErrorMessage(null); scanningRef.current = false; abortRef.current = false; }}
              className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              {pick(lang, { nl: 'Opnieuw proberen', en: 'Try again', pl: 'Spróbuj ponownie', tr: 'Tekrar dene' })}
            </button>
            <button onClick={onCancel} className="btn-press flex-1 rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted">
              {pick(lang, { nl: 'Annuleren', en: 'Cancel', pl: 'Anuluj', tr: 'İptal' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
