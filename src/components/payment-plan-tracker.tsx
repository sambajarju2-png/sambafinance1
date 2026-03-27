'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Trash2,
  AlertCircle,
  TrendingDown,
} from 'lucide-react';

interface Installment {
  id: string;
  term_number: number;
  due_date: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paid_date: string | null;
}

interface PaymentPlan {
  id: string;
  total_terms: number;
  amount_per_term: number;
  payment_day: number;
  start_date: string;
  status: 'active' | 'completed' | 'cancelled';
  plan_installments: Installment[];
  summary: {
    paid_count: number;
    total_count: number;
    paid_amount: number;
    remaining_amount: number;
  };
}

interface PaymentPlanTrackerProps {
  billId: string;
  plan: PaymentPlan;
  onUpdate: () => void;
  onCancel: () => void;
}

export function PaymentPlanTracker({
  billId,
  plan,
  onUpdate,
  onCancel,
}: PaymentPlanTrackerProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const formatCents = (cents: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
    });
  };

  const toggleInstallment = async (installment: Installment) => {
    const newStatus = installment.status === 'paid' ? 'pending' : 'paid';
    setLoading(installment.id);

    try {
      const res = await fetch(
        `/api/bills/${billId}/payment-plan/${installment.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            paid_date:
              newStatus === 'paid'
                ? new Date().toISOString().split('T')[0]
                : undefined,
          }),
        }
      );

      if (res.ok) {
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to update installment:', err);
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/bills/${billId}/payment-plan`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onCancel();
      }
    } catch (err) {
      console.error('Failed to cancel plan:', err);
    } finally {
      setCancelling(false);
    }
  };

  const progressPercent =
    plan.summary.total_count > 0
      ? Math.round(
          (plan.summary.paid_count / plan.summary.total_count) * 100
        )
      : 0;

  const isOverdue = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingDown size={16} className="text-[var(--green)]" />
            <span className="text-[13px] font-semibold text-[var(--text)]">
              Voortgang
            </span>
          </div>
          <span className="text-[13px] font-bold text-[var(--blue)]">
            {plan.summary.paid_count}/{plan.summary.total_count}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-[var(--green)] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between text-[12px]">
          <span className="text-[var(--muted)]">
            Betaald: {formatCents(plan.summary.paid_amount)}
          </span>
          <span className="text-[var(--muted)]">
            Resterend: {formatCents(plan.summary.remaining_amount)}
          </span>
        </div>
      </div>

      {/* Installment list */}
      <div className="space-y-1">
        {plan.plan_installments.map((installment) => {
          const isPaid = installment.status === 'paid';
          const isLate =
            !isPaid && isOverdue(installment.due_date);
          const isLoading = loading === installment.id;

          return (
            <button
              key={installment.id}
              onClick={() => toggleInstallment(installment)}
              disabled={isLoading}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {/* Check icon */}
              {isPaid ? (
                <CheckCircle2
                  size={22}
                  className="text-[var(--green)] flex-shrink-0"
                  fill="var(--green)"
                  stroke="white"
                />
              ) : isLate ? (
                <AlertCircle
                  size={22}
                  className="text-[var(--red)] flex-shrink-0"
                />
              ) : (
                <Circle
                  size={22}
                  className="text-[var(--border)] flex-shrink-0"
                />
              )}

              {/* Term info */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[13px] font-medium ${
                      isPaid
                        ? 'text-[var(--muted)] line-through'
                        : 'text-[var(--text)]'
                    }`}
                  >
                    Termijn {installment.term_number}
                  </span>
                  {isLate && (
                    <span className="text-[10px] font-semibold text-[var(--red)] bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded">
                      Te laat
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--muted)]">
                  {isPaid && installment.paid_date
                    ? `Betaald op ${formatDate(installment.paid_date)}`
                    : `Vervalt ${formatDate(installment.due_date)}`}
                </span>
              </div>

              {/* Amount */}
              <span
                className={`text-[14px] font-semibold flex-shrink-0 ${
                  isPaid ? 'text-[var(--green)]' : 'text-[var(--text)]'
                }`}
              >
                {formatCents(installment.amount)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cancel plan */}
      {plan.status === 'active' && (
        <div className="pt-2">
          {showCancelConfirm ? (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3">
              <p className="text-[13px] text-[var(--text)]">
                Weet je zeker dat je de betalingsregeling wilt annuleren? Alle
                voortgang wordt verwijderd.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 h-9 border border-[var(--border)] rounded-lg text-[13px] font-medium text-[var(--text)] bg-[var(--surface)]"
                >
                  Nee, behouden
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 h-9 bg-[var(--red)] text-white rounded-lg text-[13px] font-medium disabled:opacity-50"
                >
                  {cancelling ? 'Bezig...' : 'Ja, annuleren'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex items-center justify-center gap-2 w-full py-2 text-[13px] font-medium text-[var(--red)]"
            >
              <Trash2 size={14} />
              Regeling annuleren
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Small badge component for bill cards on betalingen page
export function PaymentPlanBadge({
  paidCount,
  totalCount,
}: {
  paidCount: number;
  totalCount: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--blue)] bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
      <TrendingDown size={10} />
      {paidCount}/{totalCount}
    </span>
  );
}

// Header info for bill drawer when plan exists
export function PaymentPlanHeaderInfo({
  paidAmount,
  totalAmount,
  paidCount,
  totalCount,
}: {
  paidAmount: number;
  totalAmount: number;
  paidCount: number;
  totalCount: number;
}) {
  const formatCents = (cents: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const remaining = totalAmount - paidAmount;
  const progressPercent =
    totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="text-[var(--green)] font-medium">
          {formatCents(paidAmount)} betaald
        </span>
        <span className="text-[var(--muted)]">&middot;</span>
        <span className="text-[var(--muted)]">
          {formatCents(remaining)} resterend
        </span>
      </div>
      <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--green)] rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
