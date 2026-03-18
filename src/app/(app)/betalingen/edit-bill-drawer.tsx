'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Loader2, Check } from 'lucide-react';
import { type Bill, BILL_CATEGORIES, parseToCents } from '@/lib/bills';

interface EditBillDrawerProps {
  bill: Bill;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: Bill) => void;
}

const STAGES = ['factuur', 'herinnering', 'aanmaning', 'incasso', 'deurwaarder'] as const;

export default function EditBillDrawer({ bill, open, onClose, onSaved }: EditBillDrawerProps) {
  const t = useTranslations('billDetail');
  const tAdd = useTranslations('addBill');
  const tEsc = useTranslations('escalation');

  const [vendor, setVendor] = useState(bill.vendor);
  const [amount, setAmount] = useState((bill.amount / 100).toFixed(2).replace('.', ','));
  const [dueDate, setDueDate] = useState(bill.due_date);
  const [category, setCategory] = useState(bill.category);
  const [stage, setStage] = useState(bill.escalation_stage || 'factuur');
  const [reference, setReference] = useState(bill.reference || '');
  const [iban, setIban] = useState(bill.iban || '');
  const [notes, setNotes] = useState(bill.notes || '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSave() {
    const amountCents = parseToCents(amount);
    if (!vendor.trim() || !amountCents || !dueDate) {
      setError(tAdd('errorGeneral'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: vendor.trim(),
          amount_cents: amountCents,
          due_date: dueDate,
          category,
          escalation_stage: stage,
          reference: reference.trim() || null,
          iban: iban.trim() || null,
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }

      const data = await res.json();
      setSaved(true);
      setTimeout(() => {
        onSaved(data.bill);
        onClose();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : tAdd('errorGeneral'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="drawer-enter fixed bottom-0 left-0 right-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-pw-border" />
        </div>

        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2 className="text-[16px] font-bold text-pw-navy">{t('editBill')}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4 px-4 pb-8">
          {/* Source badge */}
          <div className="text-[11px] font-medium text-pw-muted">
            Bron: {bill.source === 'gmail_scan' ? '📧 Gmail' : bill.source === 'camera_scan' ? '📸 Foto' : '✏️ Handmatig'}
          </div>

          {/* Vendor */}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-pw-text">{tAdd('vendor')} *</label>
            <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)}
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
          </div>

          {/* Amount + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-pw-text">{tAdd('amount')} *</label>
              <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-pw-text">{tAdd('dueDate')} *</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
            </div>
          </div>

          {/* Category + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-pw-text">{tAdd('category')}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none">
                {BILL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{tAdd(`categories.${cat}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-pw-text">{tAdd('stage')}</label>
              <select value={stage} onChange={(e) => setStage(e.target.value as typeof STAGES[number])}
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none">
                {STAGES.map((s) => (
                  <option key={s} value={s}>{tEsc(s)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reference + IBAN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-pw-text">{tAdd('reference')}</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={tAdd('referencePlaceholder')}
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-pw-text">IBAN</label>
              <input type="text" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="NL00ABNA0000000000"
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-pw-text">{tAdd('notes')}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={tAdd('notesPlaceholder')}
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
          </div>

          {error && <p className="text-[12px] font-semibold text-pw-red">{error}</p>}

          <button onClick={handleSave} disabled={saving || saved}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> :
             saved ? <Check className="h-4 w-4" strokeWidth={2} /> : null}
            {saved ? t('editSaved') : t('saveChanges')}
          </button>
        </div>
      </div>
    </>
  );
}
