'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, Loader2, AlertCircle, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { BILL_CATEGORIES, parseToCents } from '@/lib/bills';

interface MatchedExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  interval: string;
  monthly_amount: number;
}

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
  const [paymentUrl, setPaymentUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recurring (vaste last) state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('monthly');
  const [paymentDay, setPaymentDay] = useState('');
  const [matchedExpense, setMatchedExpense] = useState<MatchedExpense | null>(null);

  // Auto-link: check if vendor matches an existing vaste last
  const checkExpenseMatch = useCallback(async (v: string) => {
    if (v.length < 3) { setMatchedExpense(null); return; }
    try {
      const res = await fetch(`/api/bills/match-expense?vendor=${encodeURIComponent(v)}`);
      const data = await res.json();
      setMatchedExpense(data.match || null);
    } catch { setMatchedExpense(null); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (vendor.trim()) checkExpenseMatch(vendor.trim()); }, 500);
    return () => clearTimeout(timer);
  }, [vendor, checkExpenseMatch]);

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
          payment_url: paymentUrl || null,
          notes: notes || null,
          is_recurring: isRecurring,
          recurring_interval: isRecurring ? recurringInterval : undefined,
          payment_day: isRecurring && paymentDay ? parseInt(paymentDay) : undefined,
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
      setPaymentUrl('');
      setNotes('');
      setIsRecurring(false);
      setRecurringInterval('monthly');
      setPaymentDay('');
      setMatchedExpense(null);

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
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="drawer-enter fixed bottom-0 left-0 right-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        {/* Handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-pw-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2 className="text-heading-sm text-pw-navy">{t('title')}</h2>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
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
            <input id="vendor" type="text" value={vendor} onChange={(e) => setVendor(e.target.value)}
              placeholder={t('vendorPlaceholder')} required
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
          </div>

          {/* Amount + Due Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="amount" className="mb-1.5 block text-label text-pw-text">
                {t('amount')} *
              </label>
              <input id="amount" type="text" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
            </div>
            <div>
              <label htmlFor="dueDate" className="mb-1.5 block text-label text-pw-text">
                {t('dueDate')} *
              </label>
              <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
            </div>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="mb-1.5 block text-label text-pw-text">
              {t('category')}
            </label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue">
              {BILL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{t(`categories.${cat}`)}</option>
              ))}
            </select>
          </div>

          {/* IBAN */}

          {/* Auto-link suggestion */}
          {matchedExpense && !isRecurring && (
            <div className="rounded-xl border border-pw-blue/20 bg-pw-blue/5 p-3">
              <div className="flex items-start gap-2">
                <RefreshCw className="h-4 w-4 text-pw-blue mt-0.5 shrink-0" strokeWidth={1.5} />
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-pw-navy">
                    Dit lijkt op je vaste last &ldquo;{matchedExpense.name}&rdquo;
                  </p>
                  <p className="text-[11px] text-pw-muted mt-0.5">
                    € {(matchedExpense.monthly_amount / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })} /maand
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsRecurring(true)}
                    className="mt-1.5 text-[11px] font-semibold text-pw-blue hover:underline"
                  >
                    Koppelen als vaste last
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Vaste last toggle */}
          <div className="flex items-center justify-between rounded-xl border border-pw-border bg-pw-surface p-3">
            <div>
              <p className="text-[13px] font-medium text-pw-navy">Vaste last</p>
              <p className="text-[11px] text-pw-muted">Keert maandelijks terug</p>
            </div>
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`relative h-7 w-12 rounded-full transition-colors ${isRecurring ? 'bg-pw-blue' : 'bg-pw-border'}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Recurring options (shown when toggle is on) */}
          {isRecurring && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-label text-pw-text">Interval</label>
                <select value={recurringInterval} onChange={(e) => setRecurringInterval(e.target.value)}
                  className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue">
                  <option value="weekly">Wekelijks</option>
                  <option value="monthly">Maandelijks</option>
                  <option value="quarterly">Per kwartaal</option>
                  <option value="yearly">Jaarlijks</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-label text-pw-text">Afschrijfdag</label>
                <input type="number" inputMode="numeric" min="1" max="31"
                  value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)}
                  placeholder="bijv. 15"
                  className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
              </div>
            </div>
          )}

          {/* IBAN */}
          <div>
            <label htmlFor="iban" className="mb-1.5 block text-label text-pw-text">IBAN</label>
            <input id="iban" type="text" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder="NL00 BANK 0000 0000 00"
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
          </div>

          {/* Reference */}
          <div>
            <label htmlFor="reference" className="mb-1.5 block text-label text-pw-text">
              {t('reference')}
            </label>
            <input id="reference" type="text" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder={t('referencePlaceholder')}
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
          </div>

          {/* Payment URL */}
          <div>
            <label htmlFor="paymentUrl" className="mb-1.5 flex items-center gap-1.5 text-label text-pw-text">
              <LinkIcon className="h-3 w-3 text-pw-muted" strokeWidth={1.5} />
              {t('paymentUrl')}
            </label>
            <input id="paymentUrl" type="url" value={paymentUrl}
              onChange={(e) => setPaymentUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
            <p className="mt-1 text-[10px] text-pw-muted">{t('paymentUrlHint')}</p>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="mb-1.5 block text-label text-pw-text">
              {t('notes')}
            </label>
            <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} placeholder={t('notesPlaceholder')}
              className="w-full resize-none rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-input border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} />
              <p className="text-label text-pw-red">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={saving}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
            {t('save')}
          </button>
        </form>
      </div>
    </>
  );
}
