'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Camera,
  Loader2,
  AlertCircle,
  Check,
  ChevronLeft,
  RotateCcw,
  Link as LinkIcon,
} from 'lucide-react';
import { BILL_CATEGORIES, parseToCents } from '@/lib/bills';

type ScanStep = 'capture' | 'extracting' | 'confirm' | 'saving' | 'error';

export default function CameraScanPage() {
  const t = useTranslations('cameraScan');
  const router = useRouter();

  const [step, setStep] = useState<ScanStep>('capture');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extracted data (editable)
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('overig');
  const [iban, setIban] = useState('');
  const [reference, setReference] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [escalationStage, setEscalationStage] = useState('factuur');

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep('extracting');
    setError(null);

    try {
      const compressed = await compressImage(file, 1600, 0.7);

      const res = await fetch('/api/scan/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: compressed.base64,
          mime_type: compressed.mimeType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Extraction failed');
      }

      const { extraction } = await res.json();

      setVendor(extraction.vendor || '');
      setAmount(extraction.amount_cents ? (extraction.amount_cents / 100).toFixed(2).replace('.', ',') : '');
      setDueDate(extraction.due_date || '');
      setCategory(extraction.category_hint || 'overig');
      setIban(extraction.iban || '');
      setReference(extraction.reference || '');
      setPaymentUrl(extraction.payment_url || '');
      setEscalationStage(extraction.escalation_stage || 'factuur');

      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorExtraction'));
      setStep('error');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    setError(null);

    const amountCents = parseToCents(amount);
    if (!amountCents || !vendor.trim() || !dueDate) {
      setError('Vul bedrijf, bedrag en vervaldatum in');
      return;
    }

    setStep('saving');

    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: vendor.trim(),
          amount_cents: amountCents,
          due_date: dueDate,
          category,
          iban: iban || null,
          reference: reference || null,
          payment_url: paymentUrl || null,
          escalation_stage: escalationStage,
          source: 'camera_scan',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }

      router.push('/betalingen');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt');
      setStep('confirm');
    }
  }

  function handleRetry() {
    setStep('capture');
    setError(null);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-pw-bg">
      {/* Header */}
      <header className="glass-topbar sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-pw-border/50 px-4">
        <button onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/30">
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <h1 className="text-[15px] font-bold text-pw-navy">{t('title')}</h1>
      </header>

      <main className="flex-1 px-4 py-6">
        {/* STEP: CAPTURE */}
        {step === 'capture' && (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-pw-blue/10">
              <Camera className="h-10 w-10 text-pw-blue" strokeWidth={1.5} />
            </div>

            <h2 className="text-heading text-pw-navy">{t('captureTitle')}</h2>
            <p className="mt-2 max-w-[300px] text-body text-pw-muted">{t('captureDescription')}</p>

            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              capture="environment" onChange={handleFileSelect} className="hidden" />

            <button onClick={() => fileInputRef.current?.click()}
              className="btn-press mt-8 flex items-center gap-2 rounded-button bg-pw-blue px-8 py-3 text-[14px] font-semibold text-white">
              <Camera className="h-5 w-5" strokeWidth={1.5} />
              {t('takePhoto')}
            </button>

            <button onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute('capture');
                fileInputRef.current.click();
                fileInputRef.current.setAttribute('capture', 'environment');
              }
            }} className="mt-3 text-[13px] font-semibold text-pw-blue">
              {t('chooseFromGallery')}
            </button>
          </div>
        )}

        {/* STEP: EXTRACTING */}
        {step === 'extracting' && (
          <div className="flex flex-col items-center py-16 text-center">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-pw-blue" strokeWidth={1.5} />
            <h2 className="text-heading text-pw-navy">{t('extracting')}</h2>
            <p className="mt-2 text-body text-pw-muted">{t('extractingHint')}</p>
          </div>
        )}

        {/* STEP: CONFIRM (editable form) */}
        {(step === 'confirm' || step === 'saving') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
              <h2 className="text-[16px] font-bold text-pw-navy">{t('confirmTitle')}</h2>
            </div>
            <p className="text-[13px] text-pw-muted">{t('confirmDescription')}</p>

            {/* Vendor */}
            <div>
              <label className="mb-1.5 block text-label text-pw-text">{t('vendor')} *</label>
              <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)}
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
            </div>

            {/* Amount + Due Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-label text-pw-text">{t('amount')} *</label>
                <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
              </div>
              <div>
                <label className="mb-1.5 block text-label text-pw-text">{t('dueDate')} *</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-label text-pw-text">{t('category')}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue">
                {BILL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* IBAN */}
            <div>
              <label className="mb-1.5 block text-label text-pw-text">IBAN</label>
              <input type="text" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())}
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
            </div>

            {/* Reference */}
            <div>
              <label className="mb-1.5 block text-label text-pw-text">{t('reference')}</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
            </div>

            {/* Payment URL */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-label text-pw-text">
                <LinkIcon className="h-3 w-3 text-pw-muted" strokeWidth={1.5} />
                {t('paymentUrl')}
              </label>
              <input type="url" value={paymentUrl}
                onChange={(e) => setPaymentUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/40 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
              <p className="mt-1 text-[10px] text-pw-muted">{t('paymentUrlHint')}</p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-input border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} />
                <p className="text-label text-pw-red">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleRetry} disabled={step === 'saving'}
                className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-text disabled:opacity-50">
                <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
                {t('retake')}
              </button>
              <button onClick={handleSave} disabled={step === 'saving'}
                className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-50">
                {step === 'saving' ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={1.5} />
                )}
                {t('save')}
              </button>
            </div>
          </div>
        )}

        {/* STEP: ERROR */}
        {step === 'error' && (
          <div className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-pw-red" strokeWidth={1.5} />
            <h2 className="text-[16px] font-semibold text-pw-text">Er ging iets mis</h2>
            <p className="mt-2 max-w-[300px] text-[13px] text-pw-muted">
              {error || t('errorExtraction')}
            </p>
            <button onClick={handleRetry}
              className="btn-press mt-6 flex items-center gap-2 rounded-button bg-pw-blue px-6 py-3 text-[13px] font-semibold text-white">
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
              {t('tryAgain')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

async function compressImage(
  file: File,
  maxDimension: number = 1600,
  quality: number = 0.7
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
