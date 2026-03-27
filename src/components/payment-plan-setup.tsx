'use client';

import { useState } from 'react';
import { X, Calculator, Calendar, Hash } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PaymentPlanSetupProps {
  billId: string;
  billAmount: number; // cents
  vendorName: string;
  onClose: () => void;
  onCreated: () => void;
}

export function PaymentPlanSetup({
  billId,
  billAmount,
  vendorName,
  onClose,
  onCreated,
}: PaymentPlanSetupProps) {
  const t = useTranslations();
  const [totalTerms, setTotalTerms] = useState(3);
  const [paymentDay, setPaymentDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountPerTerm = Math.floor(billAmount / totalTerms);
  const lastTermAmount = billAmount - amountPerTerm * (totalTerms - 1);

  // Start date = next occurrence of the chosen payment_day
  const getStartDate = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), paymentDay);
    if (start <= now) {
      start.setMonth(start.getMonth() + 1);
    }
    return start.toISOString().split('T')[0];
  };

  const formatCents = (cents: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/bills/${billId}/payment-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_terms: totalTerms,
          payment_day: paymentDay,
          start_date: getStartDate(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Er ging iets mis');
      }

      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-[var(--bg)] rounded-t-[20px] pb-8 animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--text)]">
              Betalingsregeling
            </h2>
            <p className="text-[13px] text-[var(--muted)]">
              {vendorName} &middot; {formatCents(billAmount)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--border)]"
          >
            <X size={20} className="text-[var(--muted)]" />
          </button>
        </div>

        <div className="px-5 space-y-5">
          {/* Number of terms */}
          <div>
            <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--text)] mb-2">
              <Hash size={16} className="text-[var(--muted)]" />
              Hoeveel termijnen?
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTotalTerms(Math.max(2, totalTerms - 1))}
                className="w-10 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[16px] font-semibold text-[var(--text)] active:scale-95 transition-transform"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-[24px] font-bold text-[var(--text)]">
                  {totalTerms}
                </span>
                <span className="text-[13px] text-[var(--muted)] ml-1">
                  termijnen
                </span>
              </div>
              <button
                onClick={() => setTotalTerms(Math.min(48, totalTerms + 1))}
                className="w-10 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[16px] font-semibold text-[var(--text)] active:scale-95 transition-transform"
              >
                +
              </button>
            </div>
          </div>

          {/* Payment day */}
          <div>
            <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--text)] mb-2">
              <Calendar size={16} className="text-[var(--muted)]" />
              Welke dag van de maand?
            </label>
            <select
              value={paymentDay}
              onChange={(e) => setPaymentDay(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] appearance-none"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  {day}e van de maand
                </option>
              ))}
            </select>
          </div>

          {/* Summary card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator size={16} className="text-[var(--blue)]" />
              <span className="text-[13px] font-medium text-[var(--text)]">
                Overzicht
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--muted)]">Per termijn</span>
                <span className="font-semibold text-[var(--text)]">
                  {formatCents(amountPerTerm)}
                </span>
              </div>
              {lastTermAmount !== amountPerTerm && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--muted)]">Laatste termijn</span>
                  <span className="font-semibold text-[var(--text)]">
                    {formatCents(lastTermAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--muted)]">Eerste betaling</span>
                <span className="font-semibold text-[var(--text)]">
                  {new Date(getStartDate()).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-[13px] pt-2 border-t border-[var(--border)]">
                <span className="text-[var(--muted)]">Totaal</span>
                <span className="font-bold text-[var(--text)]">
                  {formatCents(billAmount)}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-[var(--red)] text-center">
              {error}
            </p>
          )}

          {/* Actions */}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full h-11 bg-[var(--blue)] text-white rounded-lg text-[14px] font-semibold active:scale-[0.97] transition-transform disabled:opacity-50"
          >
            {loading ? 'Bezig...' : 'Betalingsregeling starten'}
          </button>
        </div>
      </div>
    </div>
  );
}
