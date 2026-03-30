'use client';

import { useState, useRef } from 'react';
import { Camera, Loader2, ChevronLeft, AlertCircle, Check, RotateCcw, Zap, Clock, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ExtractionResult {
  extraction: {
    vendor: string;
    amount_cents: number;
    currency: string;
    iban: string | null;
    reference: string | null;
    due_date: string | null;
    category_hint: string;
    escalation_stage: string | null;
    payment_url: string | null;
    confidence: { vendor: number; amount: number; due_date: number };
  };
  ocr_text: string;
  ocr_confidence: number;
  method: string;
  fields_found: string[];
  match_sources: string[];
  extraction_confidence: number;
  timing: { ocr_ms: number; regex_ms: number; total_ms: number };
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  factuur: { label: 'Factuur', color: 'text-pw-blue bg-blue-50' },
  herinnering: { label: 'Herinnering', color: 'text-amber-700 bg-amber-50' },
  aanmaning: { label: 'Aanmaning', color: 'text-orange-700 bg-orange-50' },
  incasso: { label: 'Incasso', color: 'text-red-600 bg-red-50' },
  deurwaarder: { label: 'Deurwaarder', color: 'text-red-800 bg-red-100' },
};

export default function ScanTestPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/scan/camera-regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mime_type: file.type || 'image/jpeg' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Extraction failed');
      }

      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function reset() { setResult(null); setError(null); }

  return (
    <div className="flex min-h-dvh flex-col bg-pw-bg">
      <header className="glass-topbar sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-pw-border/50 px-4">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/30">
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <h1 className="text-[15px] font-bold text-pw-navy">Scan Test (Regex v3)</h1>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">EXPERIMENT</span>
      </header>

      <main className="flex-1 px-4 py-6">
        {/* Capture UI */}
        {!result && !loading && !error && (
          <div className="space-y-4 text-center">
            <div className="py-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
                <Zap className="h-8 w-8 text-amber-600" strokeWidth={1.5} />
              </div>
              <h2 className="text-[18px] font-bold text-pw-navy">Regex Scanner v3</h2>
              <p className="mt-1 text-[13px] text-pw-muted">
                OCR + regex + DB vendor lookup (291) + incasso register (270) + learned corrections. Geen AI.
              </p>
            </div>

            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePhoto} className="hidden" />

            <button onClick={() => fileInputRef.current?.click()}
              className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-8 py-3 text-[14px] font-semibold text-white">
              <Camera className="h-5 w-5" strokeWidth={1.5} /> Maak een foto
            </button>
            <button onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute('capture');
                fileInputRef.current.click();
                fileInputRef.current.setAttribute('capture', 'environment');
              }
            }} className="text-[13px] font-semibold text-pw-blue">
              Kies uit galerij
            </button>

            <div className="mt-6 rounded-card border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="text-[12px] font-semibold text-amber-800">v3 — DB-powered:</p>
              <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
                1. vendor_category_map (291 patronen) — bedrijf → categorie<br />
                2. incasso_agencies (270 bureaus) — Justis register<br />
                3. vendor_corrections — leert van je correcties<br />
                4. 150+ hardcoded domeinen voor instant email lookup<br />
                5. Escalatiefase detectie (50+ trefwoorden)<br />
                6. IBAN met MOD-97 validatie<br />
                7. Match sources: zien waar het resultaat vandaan komt
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-16 text-center">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-pw-blue" strokeWidth={1.5} />
            <h2 className="text-[16px] font-bold text-pw-navy">OCR + Regex v2 bezig...</h2>
            <p className="mt-2 text-[13px] text-pw-muted">Tesseract → regex → escalatie → categorie</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-pw-red" strokeWidth={1.5} />
            <p className="text-[16px] font-semibold text-pw-text">Er ging iets mis</p>
            <p className="mt-2 max-w-[300px] text-[13px] text-pw-muted">{error}</p>
            <button onClick={reset} className="btn-press mt-6 flex items-center gap-2 rounded-button bg-pw-blue px-6 py-3 text-[13px] font-semibold text-white">
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> Opnieuw
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
              <h2 className="text-[16px] font-bold text-pw-navy">Resultaat</h2>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
                <p className="text-[16px] font-bold text-pw-blue">{result.fields_found.length}</p>
                <p className="text-[9px] text-pw-muted">Velden</p>
              </div>
              <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
                <p className="text-[16px] font-bold text-pw-blue">{Math.round(result.ocr_confidence)}%</p>
                <p className="text-[9px] text-pw-muted">OCR</p>
              </div>
              <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
                <p className="text-[16px] font-bold text-amber-600">{result.timing.total_ms}ms</p>
                <p className="text-[9px] text-pw-muted">Totaal</p>
              </div>
              <div className="rounded-card border border-pw-border bg-pw-surface p-2.5 text-center">
                <p className="text-[16px] font-bold text-pw-green">€0</p>
                <p className="text-[9px] text-pw-muted">Kosten</p>
              </div>
            </div>

            {/* Timing detail */}
            <div className="flex items-center gap-3 px-1">
              <Clock className="h-3 w-3 text-pw-muted" strokeWidth={1.5} />
              <span className="text-[10px] text-pw-muted">
                OCR: {result.timing.ocr_ms}ms · Regex: {result.timing.regex_ms}ms · Confidence: {Math.round(result.extraction_confidence * 100)}%
              </span>
            </div>

            {/* Match sources */}
            {result.match_sources && result.match_sources.length > 0 && (
              <div className="flex items-center gap-1.5 px-1 flex-wrap">
                <span className="text-[10px] text-pw-muted">Matched via:</span>
                {result.match_sources.map((src) => (
                  <span key={src} className="rounded-full bg-pw-blue/10 px-2 py-0.5 text-[9px] font-semibold text-pw-blue">
                    {src.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Extracted fields */}
            <div className="rounded-card border border-pw-border bg-pw-surface overflow-hidden">
              <div className="border-b border-pw-border bg-pw-bg px-4 py-2.5">
                <p className="text-[12px] font-bold text-pw-navy">Geëxtraheerde velden</p>
              </div>
              <div className="divide-y divide-pw-border">
                {[
                  { label: 'Bedrijf', value: result.extraction.vendor, found: result.fields_found.includes('vendor') },
                  { label: 'Bedrag', value: result.extraction.amount_cents ? `€${(result.extraction.amount_cents / 100).toFixed(2)}` : null, found: result.fields_found.includes('amount') },
                  { label: 'IBAN', value: result.extraction.iban, found: result.fields_found.includes('iban') },
                  { label: 'Vervaldatum', value: result.extraction.due_date, found: result.fields_found.includes('due_date') },
                  { label: 'Referentie', value: result.extraction.reference, found: result.fields_found.includes('reference') },
                  { label: 'Categorie', value: result.extraction.category_hint, found: result.fields_found.includes('category') },
                  { label: 'Escalatie', value: result.extraction.escalation_stage, found: result.fields_found.includes('escalation_stage'), isStage: true },
                  { label: 'Betaallink', value: result.extraction.payment_url, found: result.fields_found.includes('payment_url') },
                ].map((field) => {
                  const stageInfo = field.isStage && field.value ? STAGE_LABELS[field.value] : null;
                  return (
                    <div key={field.label} className="flex items-center px-4 py-2.5">
                      <span className="text-[12px] text-pw-muted w-24 flex-shrink-0">{field.label}</span>
                      {field.found && field.value ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <Check className="h-3 w-3 text-pw-green flex-shrink-0" strokeWidth={2} />
                          {stageInfo ? (
                            <span className={`text-[12px] font-semibold rounded px-2 py-0.5 ${stageInfo.color}`}>
                              {stageInfo.label}
                            </span>
                          ) : (
                            <span className="text-[13px] font-medium text-pw-text truncate">{field.value}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <X className="h-3 w-3 text-pw-muted/40 flex-shrink-0" strokeWidth={2} />
                          <span className="text-[12px] text-pw-muted/50 italic">Niet gevonden</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* OCR Output */}
            <div className="rounded-card border border-pw-border bg-pw-surface overflow-hidden">
              <div className="border-b border-pw-border bg-pw-bg px-4 py-2.5 flex items-center justify-between">
                <p className="text-[12px] font-bold text-pw-navy">OCR Tekst</p>
                <span className="text-[10px] text-pw-muted">{result.ocr_text.length} tekens</span>
              </div>
              <div className="px-4 py-3 max-h-[300px] overflow-y-auto">
                <pre className="text-[11px] text-pw-muted whitespace-pre-wrap font-mono leading-relaxed">{result.ocr_text}</pre>
              </div>
            </div>

            <button onClick={reset}
              className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white">
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> Nog een foto proberen
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
