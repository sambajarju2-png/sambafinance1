'use client';

import { useState, useRef } from 'react';
import { Camera, Loader2, ChevronLeft, AlertCircle, Check, RotateCcw, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * TEST PAGE: /scan-test
 *
 * Uses the regex-only camera extraction (no AI).
 * Shows OCR output + extracted fields so you can compare accuracy.
 * Only available on the regex-extraction branch.
 */

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
}

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
      // Compress image
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

      const data: ExtractionResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-pw-bg">
      <header className="glass-topbar sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-pw-border/50 px-4">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/30">
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <h1 className="text-[15px] font-bold text-pw-navy">Scan Test (Regex)</h1>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">EXPERIMENT</span>
      </header>

      <main className="flex-1 px-4 py-6">
        {/* No result yet — show capture UI */}
        {!result && !loading && !error && (
          <div className="space-y-4 text-center">
            <div className="py-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
                <Zap className="h-8 w-8 text-amber-600" strokeWidth={1.5} />
              </div>
              <h2 className="text-[18px] font-bold text-pw-navy">Regex Scanner</h2>
              <p className="mt-1 text-[13px] text-pw-muted">
                Geen AI — alleen OCR + regex. Maak een foto om te testen.
              </p>
            </div>

            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePhoto} className="hidden" />

            <button onClick={() => fileInputRef.current?.click()}
              className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-8 py-3 text-[14px] font-semibold text-white">
              <Camera className="h-5 w-5" strokeWidth={1.5} />
              Maak een foto
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
              <p className="text-[12px] font-semibold text-amber-800">Hoe het werkt:</p>
              <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
                1. Tesseract OCR leest de tekst van je foto (Nederlands + Engels)<br />
                2. Regex zoekt: IBAN (met MOD-97 validatie), bedrag (€), vervaldatum, referentienummer<br />
                3. Geen Gemini, geen Claude — 100% deterministic
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-16 text-center">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-pw-blue" strokeWidth={1.5} />
            <h2 className="text-[16px] font-bold text-pw-navy">OCR + Regex bezig...</h2>
            <p className="mt-2 text-[13px] text-pw-muted">Tesseract leest de tekst, regex extraheert de velden</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-pw-red" strokeWidth={1.5} />
            <h2 className="text-[16px] font-semibold text-pw-text">Er ging iets mis</h2>
            <p className="mt-2 max-w-[300px] text-[13px] text-pw-muted">{error}</p>
            <button onClick={reset} className="btn-press mt-6 flex items-center gap-2 rounded-button bg-pw-blue px-6 py-3 text-[13px] font-semibold text-white">
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> Opnieuw proberen
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
              <h2 className="text-[16px] font-bold text-pw-navy">Resultaat</h2>
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {result.method.toUpperCase()}
              </span>
            </div>

            {/* Stats bar */}
            <div className="flex gap-2">
              <div className="flex-1 rounded-card border border-pw-border bg-pw-surface p-3 text-center">
                <p className="text-[18px] font-bold text-pw-blue">{result.fields_found.length}</p>
                <p className="text-[10px] text-pw-muted">Velden gevonden</p>
              </div>
              <div className="flex-1 rounded-card border border-pw-border bg-pw-surface p-3 text-center">
                <p className="text-[18px] font-bold text-pw-blue">{Math.round(result.ocr_confidence)}%</p>
                <p className="text-[10px] text-pw-muted">OCR confidence</p>
              </div>
              <div className="flex-1 rounded-card border border-pw-border bg-pw-surface p-3 text-center">
                <p className="text-[18px] font-bold text-pw-green">€0</p>
                <p className="text-[10px] text-pw-muted">AI kosten</p>
              </div>
            </div>

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
                  { label: 'Betaallink', value: result.extraction.payment_url, found: result.fields_found.includes('payment_url') },
                ].map((field) => (
                  <div key={field.label} className="flex items-center px-4 py-2.5">
                    <span className="text-[12px] text-pw-muted w-24 flex-shrink-0">{field.label}</span>
                    {field.found ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Check className="h-3 w-3 text-pw-green flex-shrink-0" strokeWidth={2} />
                        <span className="text-[13px] font-medium text-pw-text truncate">{field.value}</span>
                      </div>
                    ) : (
                      <span className="text-[12px] text-pw-muted/50 italic">Niet gevonden</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* OCR Output */}
            <div className="rounded-card border border-pw-border bg-pw-surface overflow-hidden">
              <div className="border-b border-pw-border bg-pw-bg px-4 py-2.5">
                <p className="text-[12px] font-bold text-pw-navy">OCR Tekst (eerste 500 tekens)</p>
              </div>
              <div className="px-4 py-3">
                <pre className="text-[11px] text-pw-muted whitespace-pre-wrap font-mono leading-relaxed">{result.ocr_text}</pre>
              </div>
            </div>

            {/* Actions */}
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
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
