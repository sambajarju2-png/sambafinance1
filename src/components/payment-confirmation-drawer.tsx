'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Camera, Image as ImageIcon, Check, Loader2, Shield,
  Trash2, Eye,
} from 'lucide-react';
import { saveImage, loadImage, deleteImage, revokeImageUrl } from '@/lib/image-store';

interface PaymentConfirmationDrawerProps {
  open: boolean;
  billId: string;
  billVendor: string;
  billAmount: string;
  existingImageUrl?: string | null;
  onClose: () => void;
  onUploaded: (url: string) => void;
  onRemoved?: () => void;
}

export default function PaymentConfirmationDrawer({
  open, billId, billVendor, billAmount,
  existingImageUrl, onClose, onUploaded, onRemoved,
}: PaymentConfirmationDrawerProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [viewFull, setViewFull] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing image from IndexedDB when drawer opens
  const loadExisting = useCallback(async () => {
    if (!billId) return;
    const url = await loadImage(billId);
    if (url) setLocalImageUrl(url);
  }, [billId]);

  useEffect(() => {
    if (open) {
      loadExisting();
    }
    return () => {
      if (localImageUrl) revokeImageUrl(localImageUrl);
      if (preview) revokeImageUrl(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, billId]);

  if (!open) return null;

  const displayUrl = localImageUrl || existingImageUrl;
  const hasExisting = !!displayUrl;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Bestand is te groot (max 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setSaving(true);
    setError(null);

    try {
      // Save to IndexedDB (local only — never leaves device)
      const objectUrl = await saveImage(billId, file);
      setLocalImageUrl(objectUrl);

      // Mark bill as having confirmation in Supabase (flag only, not the image)
      await fetch(`/api/bills/${billId}/confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stored_locally: true }),
      });

      setSaved(true);
      onUploaded('local://stored');

      setTimeout(() => {
        onClose();
        setSaved(false);
        setPreview(null);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt');
      setPreview(null);
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      await deleteImage(billId);
      setLocalImageUrl(null);

      await fetch(`/api/bills/${billId}/confirmation`, { method: 'DELETE' });

      onRemoved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verwijderen mislukt');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <div className="drawer-backdrop fixed inset-0 z-[60] bg-black/50" onClick={onClose} />

      <div className="drawer-enter fixed bottom-0 left-0 right-0 z-[60] rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-pw-border" /></div>

        <div className="px-4 pb-8 pt-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[16px] font-bold text-pw-navy">Betalingsbewijs</h2>
              <p className="text-[11px] text-pw-muted mt-0.5">Lokaal opgeslagen op je apparaat — verlaat nooit je telefoon</p>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-card border border-pw-green/20 bg-green-50/50 dark:bg-green-900/10 p-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pw-green/10">
              <Check className="h-4 w-4 text-pw-green" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-pw-green">Betaald</p>
              <p className="text-[11px] text-pw-muted truncate">{billVendor} — {billAmount}</p>
            </div>
          </div>

          {saved && (
            <div className="flex flex-col items-center py-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pw-green/10 mb-3">
                <Check className="h-7 w-7 text-pw-green" strokeWidth={2} />
              </div>
              <p className="text-[15px] font-bold text-pw-green">Bewijs opgeslagen!</p>
              <p className="text-[12px] text-pw-muted mt-1">Veilig op je apparaat — niet in de cloud</p>
            </div>
          )}

          {hasExisting && !saved && (
            <div className="space-y-3">
              <div className="relative rounded-card border border-pw-border overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displayUrl!} alt="Betalingsbewijs"
                  className="w-full max-h-[200px] object-contain bg-pw-surface cursor-pointer"
                  onClick={() => setViewFull(true)} />
                <div className="absolute top-2 right-2">
                  <button onClick={() => setViewFull(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => fileInputRef.current?.click()} disabled={saving}
                  className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-text">
                  <Camera className="h-4 w-4" strokeWidth={1.5} />
                  Vervangen
                </button>
                <button onClick={handleRemove} disabled={removing}
                  className="btn-press flex items-center justify-center gap-2 rounded-button border border-pw-red/20 bg-red-50 px-4 py-3 text-[13px] font-semibold text-pw-red">
                  {removing ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Trash2 className="h-4 w-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>
          )}

          {!hasExisting && !saved && (
            <div className="space-y-3">
              {preview && (
                <div className="relative rounded-card border border-pw-blue/20 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Preview" className="w-full max-h-[180px] object-contain bg-pw-surface" />
                  {saving && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-white" strokeWidth={1.5} />
                        <p className="text-[12px] font-semibold text-white mt-2">Opslaan...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!preview && (
                <>
                  <button onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute('capture', 'environment');
                      fileInputRef.current.click();
                    }
                  }}
                    className="btn-press flex w-full items-center gap-4 rounded-card border border-pw-border bg-pw-surface p-4 text-left">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pw-blue/10">
                      <Camera className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-bold text-pw-navy">Maak een foto</p>
                      <p className="text-[11px] text-pw-muted">Fotografeer je betaalbewijs of screenshot</p>
                    </div>
                  </button>

                  <button onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                    }
                  }}
                    className="btn-press flex w-full items-center gap-4 rounded-card border border-pw-border bg-pw-surface p-4 text-left">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pw-green/10">
                      <ImageIcon className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-bold text-pw-navy">Kies uit galerij</p>
                      <p className="text-[11px] text-pw-muted">Selecteer een screenshot of PDF</p>
                    </div>
                  </button>
                </>
              )}

              {!preview && (
                <button onClick={onClose}
                  className="w-full text-center text-[13px] font-semibold text-pw-muted py-2">
                  Overslaan
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-card border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="text-[12px] font-semibold text-pw-red">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-pw-border/50">
            <Shield className="h-3 w-3 text-pw-muted" strokeWidth={1.5} />
            <span className="text-[10px] text-pw-muted">Opgeslagen in je browser — verlaat nooit je apparaat</span>
          </div>
        </div>

        <input ref={fileInputRef} type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
          onChange={handleFileSelect} className="hidden" />
      </div>

      {viewFull && displayUrl && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center" onClick={() => setViewFull(false)}>
          <button onClick={() => setViewFull(false)} className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="h-6 w-6" strokeWidth={1.5} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayUrl} alt="Betalingsbewijs" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}
