'use client';

import { useMemo, useState } from 'react';
import { Target, X, Info } from 'lucide-react';
import { type Bill, formatCents } from '@/lib/bills';

interface SchuldenvrijCountdownProps {
  bills: Bill[];
  monthlyBudget?: number; // cents, defaults to 35000 (€350)
}

export default function SchuldenvrijCountdown({ bills, monthlyBudget = 35000 }: SchuldenvrijCountdownProps) {
  const [showExplainer, setShowExplainer] = useState(false);

  const { totalOutstanding, daysRemaining, progressPercent, totalSettled } = useMemo(() => {
    const outstanding = bills.filter((b) => b.status !== 'settled');
    const settled = bills.filter((b) => b.status === 'settled');
    const total = outstanding.reduce((sum, b) => sum + b.amount, 0);
    const settledTotal = settled.reduce((sum, b) => sum + b.amount, 0);

    if (total === 0) {
      return { totalOutstanding: 0, daysRemaining: 0, progressPercent: 100, totalSettled: settledTotal };
    }

    const days = Math.ceil((total / monthlyBudget) * 30);
    const allBillsTotal = total + settledTotal;
    const progress = allBillsTotal > 0 ? Math.round((settledTotal / allBillsTotal) * 100) : 0;

    return { totalOutstanding: total, daysRemaining: days, progressPercent: progress, totalSettled: settledTotal };
  }, [bills, monthlyBudget]);

  if (totalOutstanding === 0 && bills.length > 0) {
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
    <>
      {/* Tappable countdown card */}
      <button
        onClick={() => setShowExplainer(true)}
        className="bill-row-press w-full rounded-card border border-pw-border bg-pw-surface p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pw-blue/10">
            <Target className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-medium text-pw-muted">Schuldenvrij countdown</p>
              <Info className="h-3 w-3 text-pw-muted/50" strokeWidth={1.5} />
            </div>
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
      </button>

      {/* Explainer drawer */}
      {showExplainer && (
        <>
          <div className="drawer-backdrop fixed inset-0 z-50 bg-black/40" onClick={() => setShowExplainer(false)} />
          <div className="drawer-spring fixed bottom-0 left-0 right-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
            <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-pw-border" /></div>

            <div className="px-5 pb-8 pt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pw-blue/10">
                    <Target className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-[18px] font-bold text-pw-navy">Hoe werkt dit?</h2>
                </div>
                <button onClick={() => setShowExplainer(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-card border border-pw-border bg-pw-surface p-4">
                  <p className="text-[14px] font-semibold text-pw-navy mb-2">De countdown berekent hoeveel dagen je nodig hebt om schuldenvrij te worden.</p>
                  <p className="text-[13px] text-pw-muted leading-relaxed">
                    We nemen je totale openstaande bedrag en delen dit door wat je maandelijks kunt betalen. Zo weet je precies wanneer je klaar bent.
                  </p>
                </div>

                <div className="rounded-card border border-pw-border bg-pw-surface p-4">
                  <p className="text-[13px] font-semibold text-pw-navy mb-2">Jouw berekening:</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-pw-muted">Openstaand bedrag</span>
                      <span className="text-[13px] font-bold text-pw-text">{formatCents(totalOutstanding)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-pw-muted">Maandelijks budget</span>
                      <span className="text-[13px] font-bold text-pw-text">{formatCents(monthlyBudget)}</span>
                    </div>
                    <div className="border-t border-pw-border pt-2 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-pw-navy">Geschatte dagen</span>
                      <span className="text-[16px] font-extrabold text-pw-blue">{daysRemaining} dagen</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-card border border-pw-green/20 bg-green-50/50 p-4">
                  <p className="text-[13px] font-semibold text-pw-green mb-1">Tip</p>
                  <p className="text-[12px] text-pw-muted leading-relaxed">
                    Hoe meer je per maand betaalt, hoe sneller de countdown daalt. Betaal je op tijd? Dan voorkom je ook extra incassokosten.
                  </p>
                </div>

                <p className="text-[11px] text-pw-muted text-center">
                  Het maandbedrag kun je aanpassen in Instellingen → Budget.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
