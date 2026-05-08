'use client';

import { useState, useEffect } from 'react';
import { Building2, Lock, ArrowRight, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import FinancialOverviewCard from '@/components/finances/financial-overview-card';
import LimitReachedModal from '@/components/ui/limit-reached-modal';

type PlanId = 'gratis' | 'pro_monthly' | 'pro_yearly' | 'premium_monthly' | 'premium_yearly';

const PAID_PLANS: PlanId[] = ['pro_monthly', 'pro_yearly', 'premium_monthly', 'premium_yearly'];

export default function BankAwareFinancialSection() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasBankConnected, setHasBankConnected] = useState(false);
  const [plan, setPlan] = useState<PlanId>('gratis');
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/bank/accounts').then(r => r.json()).catch(() => ({ connections: [] })),
      fetch('/api/settings/plan').then(r => r.json()).catch(() => ({ plan: 'gratis' })),
    ]).then(([bankData, planData]) => {
      const connections: Array<{ status: string }> = bankData.connections || [];
      setHasBankConnected(connections.some(c => c.status === 'linked'));
      setPlan((planData.plan as PlanId) || 'gratis');
    }).finally(() => setLoading(false));
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-[14px] border border-pw-border/60 bg-pw-surface p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-4 rounded bg-pw-border/40" />
          <div className="h-3 w-28 rounded bg-pw-border/40" />
        </div>
        <div className="h-7 w-32 rounded bg-pw-border/50 mb-3" />
        <div className="flex gap-3">
          <div className="flex-1 rounded-lg bg-pw-border/20 h-14" />
          <div className="flex-1 rounded-lg bg-pw-border/20 h-14" />
          <div className="flex-1 rounded-lg bg-pw-border/20 h-14" />
        </div>
      </div>
    );
  }

  // ── State 1: Bank connected → show full financial overview ──
  if (hasBankConnected) {
    return <FinancialOverviewCard />;
  }

  const isPaid = PAID_PLANS.includes(plan);

  // ── State 2: No bank + Pro/Premium → show "add bank" banner ──
  if (isPaid) {
    return (
      <button
        onClick={() => router.push('/instellingen?tab=bank')}
        className="w-full rounded-[14px] border border-pw-blue/25 bg-gradient-to-br from-pw-blue/[0.04] to-pw-blue/[0.08] p-5 text-left transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pw-blue/10">
            <Building2 className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-pw-navy">Koppel je bankrekening</p>
            <p className="text-[12px] text-pw-muted mt-0.5 leading-snug">
              Zie automatisch welke rekeningen betaald zijn en hoeveel vrij besteedbaar
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-pw-blue" strokeWidth={2} />
        </div>
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-pw-blue/10 px-3 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-pw-blue animate-pulse" />
          <span className="text-[11px] font-semibold text-pw-blue">
            Inbegrepen in je {plan.startsWith('premium') ? 'Premium' : 'Pro'}-abonnement
          </span>
        </div>
      </button>
    );
  }

  // ── State 3: No bank + Free plan → locked teaser ──
  return (
    <>
      <button
        onClick={() => setShowUpgrade(true)}
        className="w-full rounded-[14px] border border-pw-border/60 bg-pw-surface p-5 text-left transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pw-muted/10">
            <Building2 className="h-5 w-5 text-pw-muted/50" strokeWidth={1.5} />
            <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-pw-blue shadow-sm">
              <Lock className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-pw-navy">Financieel overzicht</p>
            <p className="text-[12px] text-pw-muted mt-0.5 leading-snug">
              Koppel je bank om transacties automatisch bij te houden
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-pw-muted" strokeWidth={2} />
        </div>

        {/* Blurred preview rows */}
        <div className="mt-3 space-y-1.5 select-none pointer-events-none">
          {[
            { label: 'Vrij besteedbaar', value: '€ •••' },
            { label: 'Inkomen', value: '€ ••••' },
            { label: 'Vaste lasten', value: '-€ •••' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between rounded-lg bg-pw-border/20 px-3 py-2 blur-[1.5px] opacity-50">
              <span className="text-[12px] text-pw-muted">{row.label}</span>
              <span className="text-[12px] font-semibold text-pw-text">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Upgrade pill */}
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-pw-blue/20 bg-pw-blue/5 px-3 py-2">
          <Zap className="h-3.5 w-3.5 text-pw-blue" strokeWidth={2} />
          <span className="text-[12px] font-semibold text-pw-blue">
            Beschikbaar vanaf Pro — Tik om te upgraden
          </span>
        </div>
      </button>

      {showUpgrade && (
        <LimitReachedModal
          limitType="bank_account"
          currentPlan={plan}
          lang="nl"
          onClose={() => setShowUpgrade(false)}
          onUpgrade={() => {
            setShowUpgrade(false);
            router.push('/instellingen?tab=abonnement');
          }}
        />
      )}
    </>
  );
}
