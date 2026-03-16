'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { BILL_CATEGORIES, parseToCents } from '@/lib/bills';

interface AddBillDrawerProps {
  open: boolean;
  onClose: () => void;
  onBillAdded: () => void;
}

export default function AddBillDrawer({ open, onClose, onBillAdded }: AddBillDrawerProps) {
  const t = useTranslations('addBill');
  const tEsc = useTranslations('escalation');

  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('overig');
  const [iban, setIban] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountCents = parseToCents(amount);
    if (!amountCents) {
      setError(t('errorAmount'));
      return;
    }

    if (!vendor.trim()) {
      setError(t('errorVendor'));
      return;
    }

    if (!dueDate) {
      setError(t('errorDueDate'));
      return;
    }

    setSaving(true);

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
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t('errorGeneral'));
        setSaving(false);
        return;
      }

      // Reset form
      setVendor('');
      setAmount('');
      setDueDate('');
      setCategory('overig');
      setIban('');
      setReference('');
      setNotes('');

      onBillAdded();
      onClose();
    } catch {
      setError(t('errorGeneral'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="drawer-enter fixed bottom-0 left-0 right-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        {/* Handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-pw-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2 className="text-heading-sm text-pw-navy">{t('title')}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-8">
          {/* Vendor */}
          <div>
            <label htmlFor="vendor" className="mb-1.5 block text-label text-pw-text">
              {t('vendor')} *
            </label>
            <input
              id="vendor"
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder={t('vendorPlaceholder')}
              required
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
            />
          </div>

          {/* Amount + Due Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="amount" className="mb-1.5 block text-label text-pw-text">
                {t('amount')} *
              </label>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
              />
            </div>
            <div>
              <label htmlFor="dueDate" className="mb-1.5 block text-label text-pw-text">
                {t('dueDate')} *
              </label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="mb-1.5 block text-label text-pw-text">
              {t('category')}
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
            >
              {BILL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`categories.${cat}`)}
                </option>
              ))}
            </select>
          </div>

          {/* IBAN */}
          <div>
            <label htmlFor="iban" className="mb-1.5 block text-label text-pw-text">
              IBAN
            </label>
            <input
              id="iban"
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder="NL00 BANK 0000 0000 00"
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
            />
          </div>

          {/* Reference */}
          <div>
            <label htmlFor="reference" className="mb-1.5 block text-label text-pw-text">
              {t('reference')}
            </label>
            <input
              id="reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t('referencePlaceholder')}
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="mb-1.5 block text-label text-pw-text">
              {t('notes')}
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t('notesPlaceholder')}
              className="w-full resize-none rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-input border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} />
              <p className="text-label text-pw-red">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
            {t('save')}
          </button>
        </form>
      </div>
    </>
  );
}
