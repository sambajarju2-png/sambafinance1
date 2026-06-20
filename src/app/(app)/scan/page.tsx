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
  QrCode,
  Link as LinkIcon,
  Sparkles,
  Globe,
  Images,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { BILL_CATEGORIES, parseToCents } from '@/lib/bills';
import { parsePaymentQR, isEPCQR } from '@/lib/epc-qr';
import { detectGovBrand } from '@/lib/gov-brands';
import QRScanner from '@/components/qr-scanner';
import { useOrgFeatures } from '@/lib/use-org-features';
import FeatureUnavailable from '@/components/feature-unavailable';

type ScanStep = 'choose' | 'capture' | 'extracting' | 'confirm' | 'saving' | 'error' | 'qr' | 'fetching' | 'batch-processing' | 'batch-review' | 'batch-saving';

interface BatchItem {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  extraction: {
    vendor: string;
    amount: string;
    dueDate: string;
    category: string;
    iban: string;
    reference: string;
    escalationStage: string;
  } | null;
  error?: string;
  expanded: boolean;
}

export default function CameraScanPage() {
  const { features } = useOrgFeatures();
  if (!features.camera_scan) return <FeatureUnavailable />;
  return <CameraScanInner />;
}

function CameraScanInner() {
  const t = useTranslations('cameraScan');
  const router = useRouter();

  const [step, setStep] = useState<ScanStep>('choose');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('overig');
  const [iban, setIban] = useState('');
  const [reference, setReference] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [escalationStage, setEscalationStage] = useState('factuur');
  const [scanSource, setScanSource] = useState<'camera' | 'qr'>('camera');
  const [dueDateEstimated, setDueDateEstimated] = useState(false);
  const [qrLinkCaptured, setQrLinkCaptured] = useState(false);
  // Store original AI extraction for correction tracking
  const [aiExtraction, setAiExtraction] = useState<Record<string, unknown> | null>(null);
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Handle QR code scan result
  async function handleQRResult(data: string) {
    // First check if it's an EPC (inline payment data) QR
    const payment = parsePaymentQR(data);

    if (payment && payment.vendor) {
      setVendor(payment.vendor);
      setIban(payment.iban || '');
      setReference(payment.reference || '');
      if (payment.amount_cents > 0) {
        setAmount((payment.amount_cents / 100).toFixed(2).replace('.', ','));
      }
      if (payment.description && payment.description.startsWith('https://')) {
        setPaymentUrl(payment.description);
      }
      const govBrand = detectGovBrand(payment.vendor);
      if (govBrand) setCategory('overheid');

      const defaultDue = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      setDueDate(defaultDue);
      setDueDateEstimated(true);

      setScanSource('qr');
      setStep('confirm');
      return;
    }

    // If it's a URL — try to extract data from the payment page
    if (data.startsWith('http')) {
      setStep('fetching');
      setPaymentUrl(data);
      setQrLinkCaptured(true);

      try {
        const res = await fetch('/api/scan/qr-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: data }),
        });

        if (res.ok) {
          const result = await res.json();
          const ext = result.extraction;
          const capturedUrl = result.payment_url || data;
          setPaymentUrl(capturedUrl);

          if (result.has_data) {
            if (ext.vendor) setVendor(ext.vendor);
            if (ext.iban) setIban(ext.iban);
            if (ext.reference) setReference(ext.reference);
            if (ext.amount_cents) setAmount((ext.amount_cents / 100).toFixed(2).replace('.', ','));
            if (ext.due_date) {
              setDueDate(ext.due_date);
              setDueDateEstimated(false);
            } else {
              setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
              setDueDateEstimated(true);
            }
            if (ext.category_hint && ext.category_hint !== 'overig') setCategory(ext.category_hint);
            if (ext.vendor) {
              const govBrand = detectGovBrand(ext.vendor);
              if (govBrand) setCategory('overheid');
            }
            setScanSource('qr');
            setStep('confirm');
          } else {
            // No useful data — seamlessly open camera capture
            // Payment URL is already saved, camera will use it
            setStep('capture');
          }
        } else {
          // Fetch failed — seamlessly open camera capture
          setStep('capture');
        }
      } catch {
        // Network error — seamlessly open camera capture
        setStep('capture');
      }
      return;
    }

    // Unknown QR format
    setError('QR-code herkend, maar bevat geen betaalgegevens. Probeer een foto te maken van de factuur.');
    setStep('error');
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files).slice(0, 5);

    if (fileList.length > 1) {
      // BATCH MODE: process all images, then show batch review
      const items: BatchItem[] = fileList.map((f, i) => ({
        id: `batch-${i}-${Date.now()}`,
        fileName: f.name,
        status: 'pending' as const,
        extraction: null,
        expanded: i === 0,
      }));
      setBatchItems(items);
      setBatchProgress({ current: 0, total: fileList.length });
      setStep('batch-processing');

      // Process all files sequentially
      for (let i = 0; i < fileList.length; i++) {
        setBatchProgress({ current: i + 1, total: fileList.length });
        setBatchItems(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'processing' } : item
        ));

        try {
          const compressed = await compressImage(fileList[i], 1600, 0.7);
          const res = await fetch('/api/scan/camera', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: compressed.base64, mime_type: compressed.mimeType }),
          });

          if (!res.ok) throw new Error('Extraction failed');
          const { extraction } = await res.json();

          setBatchItems(prev => prev.map((item, idx) =>
            idx === i ? {
              ...item,
              status: 'done',
              extraction: {
                vendor: extraction.vendor || '',
                amount: extraction.amount_cents ? (extraction.amount_cents / 100).toFixed(2).replace('.', ',') : '',
                dueDate: extraction.due_date || '',
                category: extraction.category_hint || 'overig',
                iban: extraction.iban || '',
                reference: extraction.reference || '',
                escalationStage: extraction.escalation_stage || 'factuur',
              },
            } : item
          ));
        } catch {
          setBatchItems(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', error: 'Extractie mislukt' } : item
          ));
        }
      }

      setStep('batch-review');
    } else {
      // SINGLE FILE: keep existing flow
      setFileQueue([]);
      setQueueProgress({ current: 0, total: 0 });
      await processFile(fileList[0]);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function processFile(file: File) {

    setStep('extracting');
    setError(null);

    try {
      const compressed = await compressImage(file, 1600, 0.7);

      const res = await fetch('/api/scan/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressed.base64, mime_type: compressed.mimeType }),
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
      setPaymentUrl(extraction.payment_url || paymentUrl || ''); // Preserve QR-captured URL
      setEscalationStage(extraction.escalation_stage || 'factuur');
      setScanSource(qrLinkCaptured ? 'qr' : 'camera');

      // Store original AI result for correction tracking
      setAiExtraction({
        vendor: extraction.vendor || null,
        amount_cents: extraction.amount_cents || null,
        iban: extraction.iban || null,
        reference: extraction.reference || null,
        due_date: extraction.due_date || null,
        category_hint: extraction.category_hint || null,
      });

      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorExtraction'));
      setStep('error');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
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
          ai_extraction: aiExtraction || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }

      // If more files in queue, process next one
      if (fileQueue.length > 0) {
        const nextFile = fileQueue[0];
        setFileQueue(prev => prev.slice(1));
        setQueueProgress(prev => ({ ...prev, current: prev.current + 1 }));
        // Reset form for next file
        setVendor(''); setAmount(''); setDueDate(''); setCategory('overig');
        setIban(''); setReference(''); setPaymentUrl(''); setEscalationStage('factuur');
        setAiExtraction(null);
        await processFile(nextFile);
      } else {
        router.push('/betalingen');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt');
      setStep('confirm');
    }
  }

  function handleRetry() {
    setStep('choose');
    setError(null);
    setVendor(''); setAmount(''); setDueDate(''); setCategory('overig');
    setIban(''); setReference(''); setPaymentUrl('');
    setDueDateEstimated(false);
    setQrLinkCaptured(false);
    setAiExtraction(null);
    setBatchItems([]);
  }

  function updateBatchItem(id: string, field: string, value: string) {
    setBatchItems(prev => prev.map(item =>
      item.id === id && item.extraction
        ? { ...item, extraction: { ...item.extraction, [field]: value } }
        : item
    ));
  }

  function removeBatchItem(id: string) {
    setBatchItems(prev => prev.filter(item => item.id !== id));
  }

  function toggleBatchExpand(id: string) {
    setBatchItems(prev => prev.map(item =>
      item.id === id ? { ...item, expanded: !item.expanded } : item
    ));
  }

  async function handleBatchSave() {
    const saveable = batchItems.filter(item => item.status === 'done' && item.extraction);
    if (saveable.length === 0) return;

    setStep('batch-saving');
    let savedCount = 0;

    for (const item of saveable) {
      if (!item.extraction) continue;
      const amountCents = parseToCents(item.extraction.amount);
      if (!amountCents || !item.extraction.vendor.trim() || !item.extraction.dueDate) continue;

      try {
        const res = await fetch('/api/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendor: item.extraction.vendor.trim(),
            amount_cents: amountCents,
            due_date: item.extraction.dueDate,
            category: item.extraction.category,
            iban: item.extraction.iban || null,
            reference: item.extraction.reference || null,
            escalation_stage: item.extraction.escalationStage,
            source: 'camera_scan',
          }),
        });
        if (res.ok) savedCount++;
      } catch { /* continue with next */ }
    }

    if (savedCount > 0) {
      router.push('/betalingen');
    } else {
      setError('Geen rekeningen opgeslagen. Controleer de gegevens.');
      setStep('batch-review');
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-pw-bg">
      {/* Header */}
      {step !== 'qr' && (
        <header className="glass-topbar sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-pw-border/50 px-4">
          <button onClick={() => step === 'choose' ? router.back() : setStep('choose')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/30">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <h1 className="text-[15px] font-bold text-pw-navy">{t('title')}</h1>
        </header>
      )}

      <main className="flex-1 px-4 py-6">
        {/* STEP: CHOOSE — Photo or QR */}
        {step === 'choose' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <h2 className="text-[18px] font-bold text-pw-navy">Hoe wil je scannen?</h2>
              <p className="mt-1 text-[13px] text-pw-muted">Kies een methode om je rekening toe te voegen</p>
            </div>

            <button onClick={() => setStep('capture')}
              className="btn-press flex w-full items-center gap-4 rounded-card border border-pw-border bg-pw-surface p-5 text-left transition-colors hover:bg-pw-bg">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pw-blue/10 flex-shrink-0">
                <Camera className="h-7 w-7 text-pw-blue" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-pw-navy">Maak een foto</p>
                <p className="mt-0.5 text-[12px] text-pw-muted leading-relaxed">
                  Fotografeer je factuur of brief. We scannen en analyseren de gegevens automatisch.
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-pw-blue/10 px-2 py-1">
                <span className="text-[9px] font-bold text-pw-blue">SNEL</span>
              </div>
            </button>

            <button onClick={() => setStep('qr')}
              className="btn-press flex w-full items-center gap-4 rounded-card border border-pw-border bg-pw-surface p-5 text-left transition-colors hover:bg-pw-bg">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pw-green/10 flex-shrink-0">
                <QrCode className="h-7 w-7 text-pw-green" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-pw-navy">Scan QR-code</p>
                <p className="mt-0.5 text-[12px] text-pw-muted leading-relaxed">
                  Scan de betaal-QR op je factuur. We halen de gegevens automatisch op.
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-pw-green/10 px-2 py-1">
                <span className="text-[9px] font-bold text-pw-green">SNEL</span>
              </div>
            </button>

            <p className="text-[11px] text-pw-muted text-center pt-2">
              Je foto wordt alleen gebruikt om betaalgegevens te lezen en daarna direct verwijderd. We zien je afbeelding zelf niet. <a href="https://paywatch.app/privacy" target="_blank" rel="noopener noreferrer" className="text-pw-blue hover:underline">Privacybeleid</a>
            </p>
          </div>
        )}

        {/* STEP: QR SCANNER */}
        {step === 'qr' && (
          <QRScanner onScan={handleQRResult} onClose={() => setStep('choose')} />
        )}

        {/* STEP: FETCHING — Loading state while fetching payment page */}
        {step === 'fetching' && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="relative mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-green/10">
                <Globe className="h-8 w-8 text-pw-green" strokeWidth={1.5} />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-pw-blue">
                <Loader2 className="h-4 w-4 animate-spin text-white" strokeWidth={2} />
              </div>
            </div>
            <h2 className="text-[16px] font-bold text-pw-navy">Betaalpagina ophalen...</h2>
            <p className="mt-2 max-w-[280px] text-[13px] text-pw-muted leading-relaxed">
              We openen de link achter de QR-code en lezen de factuurgegevens uit.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-full bg-pw-bg border border-pw-border px-3 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-pw-green animate-pulse" />
              <p className="text-[11px] text-pw-muted font-mono truncate max-w-[240px]">{paymentUrl}</p>
            </div>
          </div>
        )}

        {/* STEP: CAPTURE (camera photo) */}
        {step === 'capture' && (
          <div className="flex flex-col items-center py-8 text-center">
            {/* Show success pill if QR link was captured first */}
            {qrLinkCaptured && paymentUrl && (
              <div className="mb-6 flex items-center gap-2.5 rounded-card border border-pw-green/20 bg-green-50/50 px-4 py-3 w-full max-w-[340px]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pw-green/10 flex-shrink-0">
                  <Check className="h-4 w-4 text-pw-green" strokeWidth={2} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[12px] font-bold text-pw-green">Betaallink opgeslagen</p>
                  <p className="text-[10px] text-pw-muted truncate">{paymentUrl}</p>
                </div>
              </div>
            )}

            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-pw-blue/10">
              <Camera className="h-10 w-10 text-pw-blue" strokeWidth={1.5} />
            </div>

            <h2 className="text-heading text-pw-navy">
              {qrLinkCaptured ? 'Maak nu een foto' : t('captureTitle')}
            </h2>
            <p className="mt-2 max-w-[300px] text-body text-pw-muted">
              {qrLinkCaptured
                ? 'De betaallink is bewaard. Fotografeer de factuur zodat we de rest automatisch invullen.'
                : t('captureDescription')}
            </p>

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
                fileInputRef.current.setAttribute('multiple', '');
                fileInputRef.current.click();
                setTimeout(() => {
                  fileInputRef.current?.removeAttribute('multiple');
                  fileInputRef.current?.setAttribute('capture', 'environment');
                }, 500);
              }
            }} className="mt-3 text-[13px] font-semibold text-pw-blue">
              {t('chooseFromGallery')} (max 5)
            </button>
          </div>
        )}

        {/* STEP: EXTRACTING */}
        {step === 'extracting' && (
          <div className="flex flex-col items-center py-16 text-center">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-pw-blue" strokeWidth={1.5} />
            <h2 className="text-heading text-pw-navy">{t('extracting')}</h2>
            <p className="mt-2 text-body text-pw-muted">{t('extractingHint')}</p>
            {queueProgress.total > 1 && (
              <div className="mt-4 px-4 py-2 rounded-full bg-pw-blue/5 border border-pw-blue/20">
                <p className="text-[12px] font-semibold text-pw-blue">
                  {queueProgress.current} / {queueProgress.total}
                </p>
              </div>
            )}
            {qrLinkCaptured && (
              <div className="mt-4 flex items-center gap-2 rounded-full bg-green-50 border border-pw-green/20 px-3 py-1.5">
                <Check className="h-3 w-3 text-pw-green" strokeWidth={2} />
                <p className="text-[10px] text-pw-green font-semibold">Betaallink bewaard</p>
              </div>
            )}
          </div>
        )}

        {/* STEP: CONFIRM (editable form) */}
        {(step === 'confirm' || step === 'saving') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
              <h2 className="text-[16px] font-bold text-pw-navy">{t('confirmTitle')}</h2>
            </div>

            {scanSource === 'qr' && (
              <div className="flex items-center gap-2 rounded-card border border-pw-green/20 bg-green-50/50 px-3 py-2">
                <QrCode className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
                <p className="text-[12px] text-pw-green font-semibold">
                  {qrLinkCaptured ? 'QR + foto — controleer de gegevens' : 'QR-code herkend — controleer de gegevens'}
                </p>
              </div>
            )}

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
                <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setDueDateEstimated(false); }}
                  className={`w-full rounded-input border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue ${dueDateEstimated ? 'border-pw-amber' : 'border-pw-border'}`} />
                {dueDateEstimated && (
                  <p className="mt-1 text-[10px] text-pw-amber font-medium">Geschat op 14 dagen — controleer je factuur</p>
                )}
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
              <input type="url" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)}
                placeholder="https://..."
                className={`w-full rounded-input border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/40 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue ${paymentUrl ? 'border-pw-green' : 'border-pw-border'}`} />
              {paymentUrl && qrLinkCaptured && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-pw-green font-medium">
                  <Check className="h-2.5 w-2.5" strokeWidth={2} /> Via QR-code opgeslagen
                </p>
              )}
              {!paymentUrl && (
                <p className="mt-1 text-[10px] text-pw-muted">{t('paymentUrlHint')}</p>
              )}
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

        {/* STEP: BATCH PROCESSING */}
        {step === 'batch-processing' && (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="relative mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue/10">
                <Images className="h-8 w-8 text-pw-blue" strokeWidth={1.5} />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-pw-blue">
                <Loader2 className="h-4 w-4 animate-spin text-white" strokeWidth={2} />
              </div>
            </div>
            <h2 className="text-[16px] font-bold text-pw-navy">
              {batchProgress.current} / {batchProgress.total} foto&apos;s verwerken...
            </h2>
            <p className="mt-2 text-[13px] text-pw-muted">AI leest de gegevens uit elke foto</p>

            {/* Progress dots */}
            <div className="mt-6 flex items-center gap-2">
              {batchItems.map((item) => (
                <div key={item.id} className={`h-2.5 w-2.5 rounded-full transition-all ${
                  item.status === 'done' ? 'bg-pw-green scale-110' :
                  item.status === 'processing' ? 'bg-pw-blue animate-pulse scale-125' :
                  item.status === 'error' ? 'bg-pw-red' :
                  'bg-pw-border'
                }`} />
              ))}
            </div>

            {/* File names */}
            <div className="mt-4 space-y-1">
              {batchItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-[11px]">
                  {item.status === 'done' && <Check className="h-3 w-3 text-pw-green" strokeWidth={2} />}
                  {item.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-pw-blue" strokeWidth={2} />}
                  {item.status === 'error' && <AlertCircle className="h-3 w-3 text-pw-red" strokeWidth={2} />}
                  {item.status === 'pending' && <div className="h-3 w-3 rounded-full border border-pw-border" />}
                  <span className={`truncate max-w-[200px] ${
                    item.status === 'processing' ? 'text-pw-blue font-semibold' : 'text-pw-muted'
                  }`}>{item.fileName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP: BATCH REVIEW */}
        {(step === 'batch-review' || step === 'batch-saving') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Images className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
                <h2 className="text-[16px] font-bold text-pw-navy">
                  {batchItems.filter(i => i.status === 'done').length} rekeningen gevonden
                </h2>
              </div>
              <span className="text-[11px] text-pw-muted">
                {batchItems.filter(i => i.status === 'error').length > 0 &&
                  `${batchItems.filter(i => i.status === 'error').length} mislukt`
                }
              </span>
            </div>

            <p className="text-[12px] text-pw-muted">Controleer de gegevens en pas aan indien nodig</p>

            {/* Batch items */}
            <div className="space-y-2">
              {batchItems.filter(i => i.status === 'done' && i.extraction).map((item) => (
                <div key={item.id} className="rounded-card border border-pw-border bg-pw-surface overflow-hidden">
                  {/* Collapsed header */}
                  <button
                    onClick={() => toggleBatchExpand(item.id)}
                    className="flex w-full items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Check className="h-4 w-4 flex-shrink-0 text-pw-green" strokeWidth={2} />
                      <div className="text-left min-w-0">
                        <p className="text-[13px] font-semibold text-pw-text truncate">
                          {item.extraction!.vendor || 'Onbekend'}
                        </p>
                        <p className="text-[11px] text-pw-muted">{item.extraction!.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[14px] font-bold text-pw-navy">
                        {item.extraction!.amount ? `€ ${item.extraction!.amount}` : '—'}
                      </span>
                      {item.expanded
                        ? <ChevronUp className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
                        : <ChevronDown className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
                      }
                    </div>
                  </button>

                  {/* Expanded edit form */}
                  {item.expanded && (
                    <div className="border-t border-pw-border px-4 py-3 space-y-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-pw-muted">Bedrijf</label>
                        <input type="text" value={item.extraction!.vendor}
                          onChange={(e) => updateBatchItem(item.id, 'vendor', e.target.value)}
                          className="w-full rounded-input border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-pw-muted">Bedrag</label>
                          <input type="text" inputMode="decimal" value={item.extraction!.amount}
                            onChange={(e) => updateBatchItem(item.id, 'amount', e.target.value)}
                            className="w-full rounded-input border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none" />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-pw-muted">Vervaldatum</label>
                          <input type="date" value={item.extraction!.dueDate}
                            onChange={(e) => updateBatchItem(item.id, 'dueDate', e.target.value)}
                            className="w-full rounded-input border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-pw-muted">Categorie</label>
                          <select value={item.extraction!.category}
                            onChange={(e) => updateBatchItem(item.id, 'category', e.target.value)}
                            className="w-full rounded-input border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none">
                            {BILL_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-pw-muted">IBAN</label>
                          <input type="text" value={item.extraction!.iban}
                            onChange={(e) => updateBatchItem(item.id, 'iban', e.target.value.toUpperCase())}
                            className="w-full rounded-input border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none" />
                        </div>
                      </div>
                      <button onClick={() => removeBatchItem(item.id)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-pw-red mt-1">
                        <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                        Verwijderen
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Error items */}
              {batchItems.filter(i => i.status === 'error').map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-card border border-pw-red/20 bg-red-50/50 px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-pw-red truncate">{item.fileName}</p>
                    <p className="text-[10px] text-pw-red/70">{item.error || 'Extractie mislukt'}</p>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-input border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} />
                <p className="text-label text-pw-red">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleRetry} disabled={step === 'batch-saving'}
                className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-text disabled:opacity-50">
                <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
                Opnieuw
              </button>
              <button onClick={handleBatchSave}
                disabled={step === 'batch-saving' || batchItems.filter(i => i.status === 'done').length === 0}
                className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-50">
                {step === 'batch-saving' ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={1.5} />
                )}
                {batchItems.filter(i => i.status === 'done').length} opslaan
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

async function compressImage(
  file: File, maxDimension: number = 1600, quality: number = 0.7
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) { height = (height / width) * maxDimension; width = maxDimension; }
          else { width = (width / height) * maxDimension; height = maxDimension; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
