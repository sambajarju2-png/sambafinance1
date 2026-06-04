'use client';

import { useMemo } from 'react';
import {
  PiggyBank, TrendingDown, TrendingUp, Home, AlertCircle,
  ArrowDownRight, ArrowUpRight, Wallet,
} from 'lucide-react';
import { formatCents } from '@/lib/bills';
import { getCategoryLabel, getCategoryColor, FIXED_COST_IDS } from '@/lib/analytics/categories';
import type { AnalyticsBundle } from '@/lib/analytics/types';

const RELEVANT = new Set(['uitgaven', 'inkomen', 'geldstroom', 'trend']);

function monthName(month: string) {
  return new Date(month + 'T00:00:00').toLocaleDateString('nl-NL', { month: 'long' });
}

export function LogicInsights({
  data, selectedMonth, tab, onCategoryTap,
}: {
  data: AnalyticsBundle;
  selectedMonth: string;
  tab: string;
  onCategoryTap?: (category: string, direction: 'in' | 'out') => void;
}) {
  const model = useMemo(() => {
    if (!selectedMonth || !data?.monthly_totals) return null;
    const totals = data.monthly_totals.find(m => m.month === selectedMonth);
    if (!totals) return null;

    const sorted = [...data.monthly_totals].sort((a, b) => a.month.localeCompare(b.month));
    const idx = sorted.findIndex(m => m.month === selectedMonth);
    const prev = idx > 0 ? sorted[idx - 1] : null;

    const cats = (data.monthly_categories || []).filter(c => c.month === selectedMonth && c.category !== 'eigen_rekening');
    const mergeByCat = (dir: 'in' | 'out') => {
      const map = new Map<string, number>();
      for (const c of cats.filter(x => x.direction === dir)) {
        map.set(c.category, (map.get(c.category) || 0) + c.total_cents);
      }
      return [...map.entries()].map(([category, total_cents]) => ({ category, total_cents })).sort((a, b) => b.total_cents - a.total_cents);
    };

    const out = mergeByCat('out');
    const inc = mergeByCat('in');
    const fixed = out.filter(c => FIXED_COST_IDS.includes(c.category)).reduce((a, c) => a + c.total_cents, 0);
    const overig = out.find(c => c.category === 'onbekend');

    return { totals, prev, out, inc, fixed, overig };
  }, [data, selectedMonth]);

  if (!RELEVANT.has(tab) || !model) return null;

  const { totals, prev, out, inc, fixed, overig } = model;
  const income = totals.income_cents;
  const expenses = totals.expenses_cents;
  const net = totals.net_cents;
  const isIncome = tab === 'inkomen';

  // % change vs previous month (only when the previous month is meaningful)
  const prevVal = prev ? (isIncome ? prev.income_cents : prev.expenses_cents) : 0;
  const curVal = isIncome ? income : expenses;
  const showDelta = prev && prevVal > 500; // ignore near-zero baselines that produce absurd %
  const deltaPct = showDelta ? Math.round(((curVal - prevVal) / prevVal) * 100) : 0;

  const cards: React.ReactNode[] = [];

  // 1. Net / savings highlight
  if (net >= 0) {
    cards.push(
      <div key="net" className="rounded-card border border-green-200/70 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
            <PiggyBank className="h-5 w-5 text-pw-green" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-pw-muted">Deze maand overgehouden</p>
            <p className="text-[22px] font-extrabold tracking-tight text-pw-green leading-none mt-0.5">{formatCents(net)}</p>
          </div>
        </div>
        <p className="mt-2.5 text-[12px] text-pw-muted leading-snug">
          Er kwam {formatCents(income)} binnen en je gaf {formatCents(expenses)} uit.
        </p>
      </div>
    );
  } else {
    cards.push(
      <div key="net" className="rounded-card border border-red-200/70 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
            <TrendingDown className="h-5 w-5 text-pw-red" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-pw-muted">Deze maand tekort</p>
            <p className="text-[22px] font-extrabold tracking-tight text-pw-red leading-none mt-0.5">{formatCents(Math.abs(net))}</p>
          </div>
        </div>
        <p className="mt-2.5 text-[12px] text-pw-muted leading-snug">
          Je gaf {formatCents(expenses)} uit, meer dan de {formatCents(income)} die binnenkwam.
        </p>
      </div>
    );
  }

  // 2. Two-up grid: biggest post + fixed costs (expenses) OR biggest source (income)
  if (!isIncome) {
    const biggest = out[0];
    const grid: React.ReactNode[] = [];
    if (biggest) {
      const pct = expenses > 0 ? Math.round((biggest.total_cents / expenses) * 100) : 0;
      grid.push(
        <div key="big" className="rounded-card border border-pw-border bg-pw-surface p-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: getCategoryColor(biggest.category) }} />
            <p className="text-[11px] font-medium text-pw-muted">Grootste post</p>
          </div>
          <p className="mt-1 text-[16px] font-bold text-pw-navy truncate">{getCategoryLabel(biggest.category)}</p>
          <p className="text-[11px] text-pw-muted">{formatCents(biggest.total_cents)} · {pct}%</p>
        </div>
      );
    }
    if (fixed > 0) {
      const pct = expenses > 0 ? Math.round((fixed / expenses) * 100) : 0;
      grid.push(
        <div key="fixed" className="rounded-card border border-pw-border bg-pw-surface p-3.5">
          <div className="flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5 text-pw-blue" strokeWidth={1.8} />
            <p className="text-[11px] font-medium text-pw-muted">Vaste lasten</p>
          </div>
          <p className="mt-1 text-[16px] font-bold text-pw-navy">{formatCents(fixed)}</p>
          <p className="text-[11px] text-pw-muted">{pct}% van je uitgaven</p>
        </div>
      );
    }
    if (grid.length > 0) {
      cards.push(<div key="grid" className="grid grid-cols-2 gap-2.5">{grid}</div>);
    }
  } else {
    const biggest = inc[0];
    if (biggest) {
      const pct = income > 0 ? Math.round((biggest.total_cents / income) * 100) : 0;
      cards.push(
        <div key="bigincome" className="rounded-card border border-pw-border bg-pw-surface p-3.5">
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-pw-green" strokeWidth={1.8} />
            <p className="text-[11px] font-medium text-pw-muted">Grootste bron</p>
          </div>
          <p className="mt-1 text-[16px] font-bold text-pw-navy truncate">{getCategoryLabel(biggest.category)}</p>
          <p className="text-[11px] text-pw-muted">{formatCents(biggest.total_cents)} · {pct}% van je inkomen</p>
        </div>
      );
    }
  }

  // 3. Comparison vs previous month
  if (showDelta && deltaPct !== 0 && prev) {
    const less = deltaPct < 0;
    const word = less ? 'minder' : 'meer';
    const Icon = less ? ArrowDownRight : ArrowUpRight;
    const good = isIncome ? !less : less; // less spending = good, more income = good
    cards.push(
      <div key="delta" className="flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface p-3.5">
        <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${good ? 'bg-green-50 dark:bg-green-950/30' : 'bg-pw-bg'}`}>
          <Icon className={`h-4 w-4 ${good ? 'text-pw-green' : 'text-pw-muted'}`} strokeWidth={1.8} />
        </div>
        <p className="text-[12px] text-pw-text leading-snug">
          {Math.abs(deltaPct)}% {word} {isIncome ? 'inkomen' : 'uitgegeven'} dan in {monthName(prev.month)}
        </p>
      </div>
    );
  }

  // 4. Uncategorized prompt (expenses only)
  if (!isIncome && overig && expenses > 0 && overig.total_cents / expenses > 0.15) {
    cards.push(
      <button
        key="overig"
        onClick={() => onCategoryTap?.('onbekend', 'out')}
        className="flex w-full items-center gap-3 rounded-card border border-amber-200/70 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3.5 text-left active:opacity-70 transition-opacity"
      >
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <AlertCircle className="h-4 w-4 text-pw-amber" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-pw-text">{formatCents(overig.total_cents)} nog niet ingedeeld</p>
          <p className="text-[11px] text-pw-muted">Tik om deze transacties te controleren en in te delen</p>
        </div>
      </button>
    );
  }

  if (cards.length === 0) return null;

  return <div className="mt-4 space-y-2.5">{cards}</div>;
}
