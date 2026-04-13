'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Mail, Loader2, ChevronLeft, AlertCircle, Check, RotateCcw, Zap, Clock, X, Inbox } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Tab = 'camera' | 'email';

interface CameraResult {
  extraction: Record<string, unknown>;
  ocr_text: string;
  ocr_confidence: number;
  method: string;
  fields_found: string[];
  match_sources: string[];
  extraction_confidence: number;
  timing: { ocr_ms: number; regex_ms: number; total_ms: number };
}

interface EmailResult {
  processed: number;
  bills_found: number;
  skipped_keyword: number;
  low_confidence: number;
  page_token: string | null;
  total_processed: number;
  done: boolean;
  method: string;
}

const STAGE_COLORS: Record<string, string> = {
  factuur: 'text-blue-600 bg-blue-50',
  herinnering: 'text-amber-700 bg-amber-50',
  aanmaning: 'text-orange-700 bg-orange-50',
  incasso: 'text-red-600 bg-red-50',
  deurwaarder: 'text-red-800 bg-red-100',
};

export default function ScanTestPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('camera');

  return (
    <div className="flex min-h-dvh flex-col bg-pw-bg">
      <header className="glass-topbar sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-pw-border/50 px-4">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/30">
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <h1 className="text-[15px] font-bold text-pw-navy">Regex Test Lab</h1>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">ZERO AI</span>
      </header>

      {/* Tab switcher */}
      <div className="flex border-b border-pw-border">
        {([['camera', 'Camera', Camera], ['email', 'Email', Mail]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key as Tab)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
              tab === key ? 'text-pw-blue border-pw-blue' : 'text-pw-muted border-transparent'
            }`}>
            <Icon className="h-4 w-4" strokeWidth={1.5} /> {label}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-6">
        {tab === 'camera' && <CameraTest />}
        {tab === 'email' && <EmailTest />}
      </main>
    </div>
  );
}

/* ═══ CAMERA TEST ═══ */
function CameraTest() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CameraResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/scan/camera-regex', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mime_type: file.type || 'image/jpeg' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setResult(await res.json());
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  if (loading) return <LoadingState text="OCR + Regex v4..." />;
  if (error) return <ErrorState error={error} onRetry={() => { setError(null); setResult(null); }} />;

  if (result) {
    const ext = result.extraction as Record<string, unknown>;
    return (
      <div className="space-y-4">
        <StatsBar fields={result.fields_found.length} ocr={Math.round(result.ocr_confidence)} ms={result.timing.total_ms} />
        {result.match_sources?.length > 0 && <MatchSources sources={result.match_sources} />}
        <FieldsTable extraction={ext} fieldsFound={result.fields_found} />
        <OcrText text={result.ocr_text} />
        <button onClick={() => setResult(null)} className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white">
          <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> Nog een foto
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <div className="py-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
          <Camera className="h-8 w-8 text-amber-600" strokeWidth={1.5} />
        </div>
        <h2 className="text-[18px] font-bold text-pw-navy">Camera (Regex v4)</h2>
        <p className="mt-1 text-[13px] text-pw-muted">Tesseract OCR → regex + DB lookup. Geen AI.</p>
      </div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePhoto} className="hidden" />
      <button onClick={() => fileInputRef.current?.click()} className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-8 py-3 text-[14px] font-semibold text-white">
        <Camera className="h-5 w-5" strokeWidth={1.5} /> Maak een foto
      </button>
      <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.click(); fileInputRef.current.setAttribute('capture', 'environment'); } }} className="text-[13px] font-semibold text-pw-blue">
        Kies uit galerij
      </button>
    </div>
  );
}

/* ═══ EMAIL TEST ═══ */
function EmailTest() {
  const [accounts, setAccounts] = useState<Array<{ id: string; email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<EmailResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanAccountId, setScanAccountId] = useState<string | null>(null);

  // Fetch accounts
  useEffect(() => {
    async function load() {
      try {
        const [gmailRes, outlookRes] = await Promise.all([
          fetch('/api/gmail/accounts'),
          fetch('/api/outlook/accounts'),
        ]);
        const gmail = gmailRes.ok ? ((await gmailRes.json()).accounts || []).map((a: { id: string; email: string }) => ({ ...a, provider: 'gmail' })) : [];
        const outlook = outlookRes.ok ? ((await outlookRes.json()).accounts || []).map((a: { id: string; email: string }) => ({ ...a, provider: 'outlook' })) : [];
        setAccounts([...gmail, ...outlook]);
      } catch { setError('Failed to load accounts'); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const runScan = useCallback(async (accountId: string) => {
    setScanning(true); setError(null); setResults([]);
    setScanAccountId(accountId);
    let pageToken: string | null = null;
    let totalProcessed = 0;

    try {
      // Run batches until done
      for (let batch = 0; batch < 15; batch++) { // max 15 batches
        const res = await fetch('/api/gmail/scan-regex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: accountId, page_token: pageToken, total_processed: totalProcessed }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Scan failed');
        const data: EmailResult = await res.json();
        setResults(prev => [...prev, data]);
        totalProcessed = data.total_processed;
        pageToken = data.page_token;
        if (data.done) break;
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Scan error'); }
    finally { setScanning(false); setScanAccountId(null); }
  }, []);

  const totalBills = results.reduce((s, r) => s + r.bills_found, 0);
  const totalProcessed = results.length > 0 ? results[results.length - 1].total_processed : 0;
  const totalSkipped = results.reduce((s, r) => s + (r.skipped_keyword || 0), 0);
  const totalLowConf = results.reduce((s, r) => s + (r.low_confidence || 0), 0);

  if (loading) return <LoadingState text="Accounts laden..." />;

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
          <Inbox className="h-8 w-8 text-blue-600" strokeWidth={1.5} />
        </div>
        <h2 className="text-[18px] font-bold text-pw-navy">Email (Regex v4)</h2>
        <p className="mt-1 text-[13px] text-pw-muted">Keyword filter → HTML strip → regex + DB. Geen Gemini, geen Sonnet.</p>
      </div>

      {error && <div className="flex items-center gap-2 rounded-card border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-pw-red"><AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}</div>}

      {accounts.length === 0 ? (
        <div className="text-center py-8 text-[13px] text-pw-muted">Geen e-mail accounts verbonden. Ga naar Instellingen om Gmail of Outlook te verbinden.</div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <button key={acc.id} onClick={() => runScan(acc.id)} disabled={scanning}
              className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-border bg-pw-surface p-4 text-left transition-colors hover:bg-pw-bg disabled:opacity-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-input bg-blue-50 flex-shrink-0">
                <Mail className="h-5 w-5 text-blue-500" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-pw-text truncate">{acc.email}</p>
                <p className="text-[11px] text-pw-muted">
                  {scanning && scanAccountId === acc.id ? 'Bezig met scannen...' : 'Tik om regex-scan te starten'}
                </p>
              </div>
              {scanning && scanAccountId === acc.id && <Loader2 className="h-5 w-5 animate-spin text-pw-blue flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3 mt-4">
          <h3 className="text-[14px] font-bold text-pw-navy">Resultaat</h3>

          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
              <p className="text-[16px] font-bold text-pw-blue">{totalProcessed}</p>
              <p className="text-[9px] text-pw-muted">Gescand</p>
            </div>
            <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
              <p className="text-[16px] font-bold text-pw-green">{totalBills}</p>
              <p className="text-[9px] text-pw-muted">Rekeningen</p>
            </div>
            <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
              <p className="text-[16px] font-bold text-pw-muted">{totalSkipped}</p>
              <p className="text-[9px] text-pw-muted">Overgeslagen</p>
            </div>
            <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
              <p className="text-[16px] font-bold text-amber-500">{totalLowConf}</p>
              <p className="text-[9px] text-pw-muted">Laag vertrouwen</p>
            </div>
          </div>

          <div className="rounded-card border border-pw-border bg-pw-surface p-3">
            <p className="text-[11px] font-semibold text-pw-navy mb-2">Batch details</p>
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-pw-muted py-1 border-b border-pw-border last:border-0">
                <span className="font-mono">Batch {i + 1}</span>
                <span className="flex-1" />
                <span>{r.processed} emails</span>
                <span className="text-pw-green font-semibold">{r.bills_found} bills</span>
                <span>{r.skipped_keyword || 0} skipped</span>
              </div>
            ))}
          </div>

          <div className="rounded-card border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] text-amber-700">
              Low-confidence extractions worden gelogd in de <span className="font-mono">extraction_log</span> tabel.
              Bekijk deze in Supabase → Table Editor → extraction_log om te zien welke emails regex niet kon verwerken.
            </p>
          </div>

          <button onClick={() => setResults([])} className="btn-press flex w-full items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-text">
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> Reset
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══ SHARED COMPONENTS ═══ */
function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Loader2 className="mb-4 h-12 w-12 animate-spin text-pw-blue" strokeWidth={1.5} />
      <p className="text-[16px] font-bold text-pw-navy">{text}</p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-pw-red" strokeWidth={1.5} />
      <p className="text-[13px] text-pw-muted max-w-[300px]">{error}</p>
      <button onClick={onRetry} className="btn-press mt-6 flex items-center gap-2 rounded-button bg-pw-blue px-6 py-3 text-[13px] font-semibold text-white">
        <RotateCcw className="h-4 w-4" /> Opnieuw
      </button>
    </div>
  );
}

function StatsBar({ fields, ocr, ms }: { fields: number; ocr: number; ms: number }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
        <p className="text-[16px] font-bold text-pw-blue">{fields}</p><p className="text-[9px] text-pw-muted">Velden</p>
      </div>
      <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
        <p className="text-[16px] font-bold text-pw-blue">{ocr}%</p><p className="text-[9px] text-pw-muted">OCR</p>
      </div>
      <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
        <p className="text-[16px] font-bold text-amber-600">{ms}ms</p><p className="text-[9px] text-pw-muted">Totaal</p>
      </div>
      <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
        <p className="text-[16px] font-bold text-pw-green">€0</p><p className="text-[9px] text-pw-muted">Kosten</p>
      </div>
    </div>
  );
}

function MatchSources({ sources }: { sources: string[] }) {
  return (
    <div className="flex items-center gap-1.5 px-1 flex-wrap">
      <span className="text-[10px] text-pw-muted">Matched via:</span>
      {sources.map((s) => (
        <span key={s} className="rounded-full bg-pw-blue/10 px-2 py-0.5 text-[9px] font-semibold text-pw-blue">{s.replace(/_/g, ' ')}</span>
      ))}
    </div>
  );
}

function FieldsTable({ extraction, fieldsFound }: { extraction: Record<string, unknown>; fieldsFound: string[] }) {
  const fields = [
    { label: 'Bedrijf', key: 'vendor', field: 'vendor' },
    { label: 'Namens', key: 'secondary_vendor', field: 'secondary_vendor' },
    { label: 'Bedrag', key: 'amount_cents', field: 'amount', format: (v: unknown) => v ? `€${(Number(v) / 100).toFixed(2)}` : null },
    { label: 'IBAN', key: 'iban', field: 'iban' },
    { label: 'Vervaldatum', key: 'due_date', field: 'due_date' },
    { label: 'Referentie', key: 'reference', field: 'reference' },
    { label: 'Categorie', key: 'category_hint', field: 'category' },
    { label: 'Escalatie', key: 'escalation_stage', field: 'escalation_stage', isStage: true },
    { label: 'Betaallink', key: 'payment_url', field: 'payment_url' },
    { label: 'Incasso?', key: 'is_incasso', field: 'is_incasso', format: (v: unknown) => v ? 'Ja' : null },
  ];

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface overflow-hidden">
      <div className="border-b border-pw-border bg-pw-bg px-4 py-2.5">
        <p className="text-[12px] font-bold text-pw-navy">Geëxtraheerde velden</p>
      </div>
      <div className="divide-y divide-pw-border">
        {fields.map((f) => {
          const rawValue = extraction[f.key];
          const value = f.format ? f.format(rawValue) : (rawValue as string);
          const found = fieldsFound.includes(f.field) && value;
          const stageColor = f.isStage && value ? STAGE_COLORS[value as string] : null;
          return (
            <div key={f.label} className="flex items-center px-4 py-2.5">
              <span className="text-[12px] text-pw-muted w-24 flex-shrink-0">{f.label}</span>
              {found ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="h-3 w-3 text-pw-green flex-shrink-0" strokeWidth={2} />
                  {stageColor ? (
                    <span className={`text-[12px] font-semibold rounded px-2 py-0.5 ${stageColor}`}>{value}</span>
                  ) : (
                    <span className="text-[13px] font-medium text-pw-text truncate">{String(value)}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <X className="h-3 w-3 text-pw-muted/40 flex-shrink-0" strokeWidth={2} />
                  <span className="text-[12px] text-pw-muted/50 italic">—</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OcrText({ text }: { text: string }) {
  return (
    <div className="rounded-card border border-pw-border bg-pw-surface overflow-hidden">
      <div className="border-b border-pw-border bg-pw-bg px-4 py-2.5">
        <p className="text-[12px] font-bold text-pw-navy">OCR Tekst</p>
      </div>
      <div className="px-4 py-3 max-h-[200px] overflow-y-auto">
        <pre className="text-[10px] text-pw-muted whitespace-pre-wrap font-mono leading-relaxed">{text}</pre>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}
