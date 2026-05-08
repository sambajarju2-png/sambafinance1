'use client';

import { useMemo, useState, useEffect } from 'react';
import { Target, X, Info, Settings } from 'lucide-react';
import { type Bill, formatCents } from '@/lib/bills';
import { useTranslations } from 'next-intl';

interface SchuldenvrijCountdownProps {
  bills: Bill[];
}

export default function SchuldenvrijCountdown({ bills }: SchuldenvrijCountdownProps) {
  const t = useTranslations('countdown');
  const [showExplainer, setShowExplainer] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user's actual monthly budget from settings
  useEffect(() => {
    async function loadBudget() {
      try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) {
          const { profile } = await res.json();
          if (profile?.monthly_budget_cents && profile.monthly_budget_cents > 0) {
            setMonthlyBudget(profile.monthly_budget_cents);
          }
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    loadBudget();
  }, []);

  const { totalOutstanding, weeksRemaining, progressPercent, totalSettled } = useMemo(() => {
    const outstanding = bills.filter((b) => b.status !== 'settled');
    const settled = bills.filter((b) => b.status === 'settled');
    const total = outstanding.reduce((sum, b) => sum + b.amount, 0);
    const settledTotal = settled.reduce((sum, b) => sum + b.amount, 0);

    if (total === 0) {
      return { totalOutstanding: 0, weeksRemaining: 0, progressPercent: 100, totalSettled: settledTotal };
    }

    // If no budget set, we can't calculate
    if (!monthlyBudget || monthlyBudget <= 0) {
      const allBillsTotal = total + settledTotal;
      const progress = allBillsTotal > 0 ? Math.round((settledTotal / allBillsTotal) * 100) : 0;
      return { totalOutstanding: total, weeksRemaining: -1, progressPercent: progress, totalSettled: settledTotal };
    }

    // Calculate weeks: (total / monthly) * 4.33 weeks per month
    const rawWeeks = (total / monthlyBudget) * 4.33;
    // Round: < .5 rounds down, >= .5 rounds up
    const weeks = Math.round(rawWeeks);

    const allBillsTotal = total + settledTotal;
    const progress = allBillsTotal > 0 ? Math.round((settledTotal / allBillsTotal) * 100) : 0;

    return { totalOutstanding: total, weeksRemaining: Math.max(weeks, 1), progressPercent: progress, totalSettled: settledTotal };
  }, [bills, monthlyBudget]);

  if (loading) return <div className="skeleton h-[100px] rounded-card" />;

  if (totalOutstanding === 0 && bills.length > 0) {
    return (
      <div className="rounded-card border border-pw-green/20 bg-green-50/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pw-green/10">
            <Target className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-pw-green">{t('debtFree')}</p>
            <p className="text-[12px] text-pw-muted">{t('allPaid')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (bills.length === 0) return null;

  // No budget set — show prompt to set one
  if (!monthlyBudget || weeksRemaining === -1) {
    return (
      <a href="/instellingen?tab=budget" className="bill-row-press flex w-full items-center gap-3 rounded-card border border-pw-amber/20 bg-amber-50/30 p-4 text-left">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pw-amber/10">
          <Target className="h-5 w-5 text-pw-amber" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-pw-navy">{t('setMonthlyBudget')}</p>
          <p className="text-[11px] text-pw-muted">{t('setMonthlyBudgetDesc')}</p>
        </div>
        <Settings className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
      </a>
    );
  }

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
              <p className="text-[11px] font-medium text-pw-muted">{t('debtFreeCountdown')}</p>
              <Info className="h-3 w-3 text-pw-muted/50" strokeWidth={1.5} />
            </div>
            <p className="text-[24px] font-extrabold tracking-tight text-pw-navy">
              {weeksRemaining} <span className="text-[14px] font-semibold text-pw-muted">{weeksRemaining === 1 ? t('week') : t('weeks')}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-pw-muted">{t('remaining')}</p>
            <p className="text-[14px] font-bold text-pw-text">{formatCents(totalOutstanding)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-pw-muted">
            <span>{progressPercent}% {t('paid')}</span>
            <span>{t('basedOn')} {formatCents(monthlyBudget)}{t('perMonth')}</span>
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
                  <h2 className="text-[18px] font-bold text-pw-navy">{t('howDoesThisWork')}</h2>
                </div>
                <button onClick={() => setShowExplainer(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-card border border-pw-border bg-pw-surface p-4">
                  <p className="text-[14px] font-semibold text-pw-navy mb-2">{t('explainerTitle')}</p>
                  <p className="text-[13px] text-pw-muted leading-relaxed">
                    {t('explainerDesc')}
                  </p>
                </div>

                <div className="rounded-card border border-pw-border bg-pw-surface p-4">
                  <p className="text-[13px] font-semibold text-pw-navy mb-2">{t('yourCalculation')}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-pw-muted">{t('outstandingAmount')}</span>
                      <span className="text-[13px] font-bold text-pw-text">{formatCents(totalOutstanding)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-pw-muted">{t('monthlyBudget')}</span>
                      <span className="text-[13px] font-bold text-pw-text">{formatCents(monthlyBudget)}</span>
                    </div>
                    <div className="border-t border-pw-border pt-2 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-pw-navy">{t('estimatedTime')}</span>
                      <span className="text-[16px] font-extrabold text-pw-blue">{weeksRemaining} {weeksRemaining === 1 ? t('week') : t('weeks')}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-card border border-pw-green/20 bg-green-50/50 p-4">
                  <p className="text-[13px] font-semibold text-pw-green mb-1">{t('tip')}</p>
                  <p className="text-[12px] text-pw-muted leading-relaxed">
                    {t('tipText')}
                  </p>
                </div>

                <a href="/instellingen?tab=budget" className="flex items-center justify-center gap-2 text-[12px] font-semibold text-pw-blue">
                  <Settings className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {t('adjustBudget')}
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
