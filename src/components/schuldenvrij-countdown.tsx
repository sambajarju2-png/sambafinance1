'use client';

import { useMemo } from 'react';
import { Target } from 'lucide-react';
import { type Bill, formatCents } from '@/lib/bills';

interface SchuldenvrijCountdownProps {
  bills: Bill[];
  monthlyBudget?: number; // cents, defaults to 35000 (€350)
}

export default function SchuldenvrijCountdown({ bills, monthlyBudget = 35000 }: SchuldenvrijCountdownProps) {
  const { totalOutstanding, daysRemaining, progressPercent, totalSettled } = useMemo(() => {
    const outstanding = bills.filter((b) => b.status !== 'settled');
    const settled = bills.filter((b) => b.status === 'settled');
    const total = outstanding.reduce((sum, b) => sum + b.amount, 0);
    const settledTotal = settled.reduce((sum, b) => sum + b.amount, 0);

    if (total === 0) {
      return { totalOutstanding: 0, daysRemaining: 0, progressPercent: 100, totalSettled: settledTotal };
    }

    // days = (outstanding cents) / (monthly budget cents) * 30
    const days = Math.ceil((total / monthlyBudget) * 30);
    const allBillsTotal = total + settledTotal;
    const progress = allBillsTotal > 0 ? Math.round((settledTotal / allBillsTotal) * 100) : 0;

    return { totalOutstanding: total, daysRemaining: days, progressPercent: progress, totalSettled: settledTotal };
  }, [bills, monthlyBudget]);

  if (totalOutstanding === 0 && bills.length > 0) {
    // Debt free!
    return (
      <div className="rounded-card border border-pw-green/20 bg-green-50/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pw-green/10">
            <Target className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-pw-green">Schuldenvrij!</p>
            <p className="text-[12px] text-pw-muted">Alle rekeningen zijn betaald</p>
          </div>
        </div>
      </div>
    );
  }

  if (bills.length === 0) return null;

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pw-blue/10">
          <Target className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-medium text-pw-muted">Schuldenvrij countdown</p>
          <p className="text-[24px] font-extrabold tracking-tight text-pw-navy">
            {daysRemaining} <span className="text-[14px] font-semibold text-pw-muted">dagen</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-pw-muted">Resterend</p>
          <p className="text-[14px] font-bold text-pw-text">{formatCents(totalOutstanding)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-pw-muted">
          <span>{progressPercent}% betaald</span>
          <span>o.b.v. {formatCents(monthlyBudget)}/maand</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-pw-border">
          <div
            className="h-full rounded-full bg-pw-green transition-all duration-500"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
