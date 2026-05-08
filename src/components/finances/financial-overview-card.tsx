'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ArrowRight, Wallet, Receipt, Home as HomeIcon, AlertTriangle, Check } from 'lucide-react';
import { formatCents } from '@/lib/bills';
import { useRouter } from 'next/navigation';
import type { FinancesData } from '@/hooks/useDashboardData';

interface Props {
  initialData?: FinancesData | null;
}

export default function FinancialOverviewCard({ initialData }: Props = {}) {
  const [data, setData] = useState<FinancesData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const router = useRouter();

  useEffect(() => {
    if (initialData !== undefined) return; // skip fetch — data came from composite route
    fetch('/api/finances/overview')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialData]);

  if (loading) {
    return (
      <div className="rounded-[14px] border border-pw-border/60 bg-pw-surface p-4 space-y-3 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-pw-border/40" />
          <div className="h-3 w-28 rounded bg-pw-border/40" />
        </div>
        <div className="h-7 w-32 rounded bg-pw-border/50" />
        <div className="flex gap-3">
          <div className="flex-1 rounded-lg bg-pw-border/20 h-14" />
          <div className="flex-1 rounded-lg bg-pw-border/20 h-14" />
          <div className="flex-1 rounded-lg bg-pw-border/20 h-14" />
        </div>
      </div>
    );
  }

  if (!data || !data.has_finances) {
    return (
      <button
        onClick={() => router.push('/instellingen?tab=finances')}
        className="w-full rounded-[14px] border border-dashed border-pw-blue/30 bg-pw-blue/[0.03] p-5 text-left transition-colors hover:bg-pw-blue/[0.06]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pw-blue/10">
            <Wallet className="h-5 w-5 text-pw-blue" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-pw-text">Stel je financieel overzicht in</p>
            <p className="text-[12px] text-pw-muted">
              Vul je inkomen in en zie direct hoeveel je overhoudt
            </p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 text-pw-muted" />
        </div>
      </button>
    );
  }

  const isNegative = data.vrij_besteedbaar < 0;
  const isLow = data.vrij_besteedbaar > 0 && data.vrij_besteedbaar < 10000;

  return (
    <div className={`rounded-[14px] border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04)] ${
      isNegative
        ? 'border-pw-red/20 bg-pw-red/[0.03]'
        : isLow
        ? 'border-amber-400/20 bg-amber-50/30 dark:bg-amber-500/[0.05]'
        : 'border-pw-border/60 bg-pw-surface'
    }`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-[11.5px] font-medium text-pw-muted">Vrij besteedbaar deze maand</p>
          <p className={`mt-0.5 text-[28px] font-extrabold leading-none tracking-[-0.03em] ${
            isNegative ? 'text-pw-red' : isLow ? 'text-amber-600' : 'text-pw-green'
          }`}>
            {formatCents(data.vrij_besteedbaar)}
          </p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          isNegative ? 'bg-pw-red/10' : isLow ? 'bg-amber-100 dark:bg-amber-500/10' : 'bg-pw-green/10'
        }`}>
          {isNegative ? (
            <TrendingDown className="h-4.5 w-4.5 text-pw-red" />
          ) : (
            <TrendingUp className={`h-4.5 w-4.5 ${isLow ? 'text-amber-600' : 'text-pw-green'}`} />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5 text-pw-muted">
            <Wallet className="h-3 w-3" /> Inkomen
          </span>
          <span className="font-medium text-pw-text">{formatCents(data.totaal_inkomen)}</span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5 text-pw-muted">
            <HomeIcon className="h-3 w-3" /> Vaste lasten ({data.expenses_count})
          </span>
          <span className="font-medium text-pw-text">-{formatCents(data.totaal_vaste_lasten)}</span>
        </div>
        {data.totaal_open_rekeningen > 0 && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 text-pw-muted">
              <Receipt className="h-3 w-3" /> Open rekeningen ({data.bills_count})
            </span>
            <span className="font-medium text-pw-red">-{formatCents(data.totaal_open_rekeningen)}</span>
          </div>
        )}
        {data.totaal_betaald_deze_maand > 0 && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 text-pw-muted">
              <Check className="h-3 w-3" /> Betaald deze maand
            </span>
            <span className="font-medium text-pw-green">-{formatCents(data.totaal_betaald_deze_maand)}</span>
          </div>
        )}
      </div>

      {data.expenses_in_incasso && data.expenses_in_incasso.length > 0 && (
        <div className="mt-3 rounded-lg bg-pw-red/[0.06] px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] font-medium text-pw-red">
            <AlertTriangle className="h-3 w-3" />
            {data.expenses_in_incasso.length} vaste last{data.expenses_in_incasso.length > 1 ? 'en' : ''} in incasso
          </p>
        </div>
      )}

      {data.salary_window && (
        <p className="mt-2 text-[10.5px] text-pw-muted">
          Salarisbetaling verwacht: dag {data.salary_window.from}–{data.salary_window.to}
        </p>
      )}
    </div>
  );
}
