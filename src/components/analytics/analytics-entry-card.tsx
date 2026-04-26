'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCents } from '@/lib/bills';
import { haptic } from '@/lib/capacitor';

interface MiniSummary {
  has_bank_connection: boolean;
  income: number;
  expenses: number;
  net: number;
}

export default function AnalyticsEntryCard() {
  const router = useRouter();
  const [data, setData] = useState<MiniSummary | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/analytics');
        if (res.ok) {
          const d = await res.json();
          if (d.has_bank_connection && d.monthly_totals?.length > 0) {
            const latest = d.monthly_totals[0];
            setData({
              has_bank_connection: true,
              income: latest.income_cents,
              expenses: latest.expenses_cents,
              net: latest.net_cents,
            });
          }
        }
      } catch { /* silent */ }
    }
    load();
  }, []);

  if (!data?.has_bank_connection) return null;

  return (
    <button
      onClick={() => { haptic('tap'); router.push('/analytics'); }}
      className="btn-press w-full rounded-card-lg border border-pw-blue/15 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 dark:from-blue-950/30 dark:to-indigo-950/15 p-4 text-left transition-all active:scale-[0.98]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-pw-blue/10">
            <BarChart3 className="h-4 w-4 text-pw-blue" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-pw-navy">Financieel inzicht</p>
            <p className="text-[11px] text-pw-muted">Deze maand</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
      </div>

      <div className="mt-3 flex gap-3">
        <div className="flex-1 rounded-[8px] bg-pw-surface/80 dark:bg-pw-surface/40 px-2.5 py-1.5">
          <p className="text-[9px] text-pw-muted">Inkomen</p>
          <p className="text-[13px] font-bold text-pw-green">{formatCents(data.income)}</p>
        </div>
        <div className="flex-1 rounded-[8px] bg-pw-surface/80 dark:bg-pw-surface/40 px-2.5 py-1.5">
          <p className="text-[9px] text-pw-muted">Uitgaven</p>
          <p className="text-[13px] font-bold text-pw-red">{formatCents(data.expenses)}</p>
        </div>
        <div className="flex-1 rounded-[8px] bg-pw-surface/80 dark:bg-pw-surface/40 px-2.5 py-1.5">
          <p className="text-[9px] text-pw-muted">Netto</p>
          <div className="flex items-center gap-1">
            {data.net >= 0 ? (
              <TrendingUp className="h-3 w-3 text-pw-green" strokeWidth={2} />
            ) : (
              <TrendingDown className="h-3 w-3 text-pw-red" strokeWidth={2} />
            )}
            <p className={`text-[13px] font-bold ${data.net >= 0 ? 'text-pw-green' : 'text-pw-red'}`}>
              {formatCents(Math.abs(data.net))}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
