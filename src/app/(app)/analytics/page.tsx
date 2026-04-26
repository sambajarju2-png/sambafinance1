'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Loader2,
  ChevronLeft, ChevronRight, Wallet, ArrowDownUp, BarChart3, Target,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { formatCents } from '@/lib/bills';
import { getCategoryLabel, getCategoryColor, DEBT_CATEGORY_IDS, FIXED_COST_IDS } from '@/lib/analytics/categories';
import type { AnalyticsBundle, MonthlyCategoryItem, WeeklyCashflowItem, MonthlyTotalItem, DebtItem } from '@/lib/analytics/types';
import { haptic } from '@/lib/capacitor';

type AnalyticsTab = 'uitgaven' | 'inkomen' | 'geldstroom' | 'trend' | 'schuld';

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'uitgaven', label: 'Uitgaven' },
  { id: 'inkomen', label: 'Inkomen' },
  { id: 'geldstroom', label: 'Geldstroom' },
  { id: 'trend', label: 'Trend' },
  { id: 'schuld', label: 'Schuld' },
];

// Chart color palette
const CHART_COLORS = [
  '#2563EB', '#059669', '#EA580C', '#7C3AED', '#DB2777',
  '#0891B2', '#CA8A04', '#DC2626', '#6366F1', '#94A3B8',
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-pw-border bg-pw-surface px-3 py-2 shadow-lg">
      {label && <p className="text-[10px] text-pw-muted mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-[12px]" style={{ color: p.color }}>
          {p.name}: <strong>{formatCents(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AnalyticsTab>('uitgaven');
  const [data, setData] = useState<AnalyticsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/analytics');
        if (res.ok) {
          const d = await res.json();
          setData(d);
          // Default to current month
          if (d.monthly_totals?.length > 0) {
            setSelectedMonth(d.monthly_totals[0].month);
          }
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Available months for navigation
  const months = useMemo(() => {
    if (!data?.monthly_totals) return [];
    return data.monthly_totals.map(m => m.month).sort().reverse();
  }, [data]);

  const currentMonthIdx = months.indexOf(selectedMonth);

  function prevMonth() {
    if (currentMonthIdx < months.length - 1) {
      setSelectedMonth(months[currentMonthIdx + 1]);
      haptic('tap');
    }
  }

  function nextMonth() {
    if (currentMonthIdx > 0) {
      setSelectedMonth(months[currentMonthIdx - 1]);
      haptic('tap');
    }
  }

  const monthLabel = selectedMonth
    ? new Date(selectedMonth + 'T00:00:00').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    : '';

  // Current month summary
  const currentTotal = useMemo(() => {
    if (!data?.monthly_totals || !selectedMonth) return null;
    return data.monthly_totals.find(m => m.month === selectedMonth) || null;
  }, [data, selectedMonth]);

  // Filtered spending categories for selected month
  const spendingData = useMemo(() => {
    if (!data?.monthly_categories || !selectedMonth) return [];
    const items = data.monthly_categories
      .filter(m => m.month === selectedMonth && m.direction === 'out' && m.category !== 'eigen_rekening')
      .reduce((acc, item) => {
        const existing = acc.find(a => a.category === item.category);
        if (existing) {
          existing.total_cents += item.total_cents;
          existing.tx_count += item.tx_count;
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, [] as MonthlyCategoryItem[]);
    items.sort((a, b) => b.total_cents - a.total_cents);
    return items;
  }, [data, selectedMonth]);

  // Filtered income categories for selected month
  const incomeData = useMemo(() => {
    if (!data?.monthly_categories || !selectedMonth) return [];
    const items = data.monthly_categories
      .filter(m => m.month === selectedMonth && m.direction === 'in' && m.category !== 'eigen_rekening')
      .reduce((acc, item) => {
        const existing = acc.find(a => a.category === item.category);
        if (existing) {
          existing.total_cents += item.total_cents;
          existing.tx_count += item.tx_count;
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, [] as MonthlyCategoryItem[]);
    items.sort((a, b) => b.total_cents - a.total_cents);
    return items;
  }, [data, selectedMonth]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pw-blue" />
      </div>
    );
  }

  if (!data?.has_bank_connection) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <BarChart3 className="mb-4 h-14 w-14 text-pw-muted/40" strokeWidth={1.2} />
        <h2 className="text-[18px] font-bold text-pw-navy">Financieel inzicht</h2>
        <p className="mt-2 text-[13px] text-pw-muted leading-relaxed max-w-[280px]">
          Koppel je bankrekening om een volledig overzicht van je inkomsten, uitgaven en schulden te zien.
        </p>
        <button
          onClick={() => router.push('/instellingen')}
          className="btn-press mt-6 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white"
        >
          Bank koppelen
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="px-4 pt-2 pb-3">
        <button onClick={() => router.back()} className="mb-3 flex items-center gap-1 text-[13px] text-pw-muted">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Terug
        </button>
        <h1 className="text-heading text-pw-navy">Financieel inzicht</h1>

        {/* Month navigation */}
        <div className="mt-3 flex items-center justify-between">
          <button onClick={prevMonth} disabled={currentMonthIdx >= months.length - 1}
            className="rounded-full p-1.5 text-pw-muted hover:text-pw-text disabled:opacity-20">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <p className="text-[15px] font-semibold text-pw-navy capitalize">{monthLabel}</p>
          <button onClick={nextMonth} disabled={currentMonthIdx <= 0}
            className="rounded-full p-1.5 text-pw-muted hover:text-pw-text disabled:opacity-20">
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Summary bar */}
        {currentTotal && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Inkomen', value: currentTotal.income_cents, color: 'text-pw-green' },
              { label: 'Uitgaven', value: currentTotal.expenses_cents, color: 'text-pw-red' },
              { label: 'Netto', value: currentTotal.net_cents, color: currentTotal.net_cents >= 0 ? 'text-pw-green' : 'text-pw-red' },
            ].map(m => (
              <div key={m.label} className="rounded-[10px] border border-pw-border bg-pw-surface p-2.5 text-center">
                <p className="text-[10px] text-pw-muted">{m.label}</p>
                <p className={`text-[14px] font-bold ${m.color}`}>{formatCents(Math.abs(m.value))}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div ref={tabsRef} className="flex overflow-x-auto border-b border-pw-border px-4 scrollbar-hide">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); haptic('tap'); }}
            className={`flex-none whitespace-nowrap px-3.5 py-2.5 text-[13px] font-medium transition-colors
              ${tab === t.id
                ? 'border-b-2 border-pw-blue text-pw-blue font-semibold'
                : 'border-b-2 border-transparent text-pw-muted'
              }`}
          >
            {t.label}
            {t.id === 'schuld' && data.debt_summary.length > 0 && (
              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-pw-red text-[9px] font-bold text-white">
                {data.debt_summary.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 pt-4">
        {tab === 'uitgaven' && <TabUitgaven data={spendingData} />}
        {tab === 'inkomen' && <TabInkomen data={incomeData} />}
        {tab === 'geldstroom' && <TabGeldstroom data={data.weekly_cashflow} />}
        {tab === 'trend' && <TabTrend data={data.monthly_totals} />}
        {tab === 'schuld' && <TabSchuld debts={data.debt_summary} totals={data.monthly_totals} />}
      </div>
    </div>
  );
}

// ─── Tab: Uitgaven ────────────────────────────────────────────

function TabUitgaven({ data }: { data: MonthlyCategoryItem[] }) {
  const total = data.reduce((a, c) => a + c.total_cents, 0);

  if (data.length === 0) {
    return <EmptyState message="Geen uitgaven gevonden voor deze maand." />;
  }

  const chartData = data.map(d => ({
    name: getCategoryLabel(d.category),
    value: d.total_cents,
    category: d.category,
  }));

  return (
    <div className="space-y-4">
      <div className="relative h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" cx="50%" cy="50%"
              innerRadius={65} outerRadius={95} paddingAngle={2}
              startAngle={90} endAngle={-270}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={getCategoryColor(d.category)} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <text x="50%" y="46%" textAnchor="middle" className="fill-pw-muted text-[11px]">Totaal</text>
            <text x="50%" y="58%" textAnchor="middle" className="fill-pw-navy text-[18px] font-bold">{formatCents(total)}</text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-card border border-pw-border bg-pw-surface p-3.5">
        <div className="space-y-2.5">
          {data.map((d, i) => {
            const pct = total > 0 ? Math.round((d.total_cents / total) * 100) : 0;
            return (
              <div key={d.category}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: getCategoryColor(d.category) }} />
                    <span className="text-[12px] font-medium text-pw-text">{getCategoryLabel(d.category)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-pw-muted">{pct}%</span>
                    <span className="text-[12px] font-semibold text-pw-navy min-w-[60px] text-right">{formatCents(d.total_cents)}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-pw-border/60">
                  <div className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: getCategoryColor(d.category) }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Inkomen ─────────────────────────────────────────────

function TabInkomen({ data }: { data: MonthlyCategoryItem[] }) {
  const total = data.reduce((a, c) => a + c.total_cents, 0);

  if (data.length === 0) {
    return <EmptyState message="Geen inkomen gevonden voor deze maand." />;
  }

  const chartData = data.map(d => ({
    name: getCategoryLabel(d.category),
    value: d.total_cents,
    category: d.category,
  }));

  return (
    <div className="space-y-4">
      <div className="relative h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" cx="50%" cy="50%"
              innerRadius={65} outerRadius={95} paddingAngle={2}
              startAngle={90} endAngle={-270}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={getCategoryColor(d.category)} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <text x="50%" y="46%" textAnchor="middle" className="fill-pw-muted text-[11px]">Inkomen</text>
            <text x="50%" y="58%" textAnchor="middle" className="fill-pw-green text-[18px] font-bold">{formatCents(total)}</text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-card border border-pw-border bg-pw-surface p-3.5">
        <div className="space-y-2.5">
          {data.map((d) => {
            const pct = total > 0 ? Math.round((d.total_cents / total) * 100) : 0;
            return (
              <div key={d.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: getCategoryColor(d.category) }} />
                  <span className="text-[12px] font-medium text-pw-text">{getCategoryLabel(d.category)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-pw-muted">{pct}%</span>
                  <span className="text-[12px] font-semibold text-pw-green min-w-[60px] text-right">{formatCents(d.total_cents)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Geldstroom ──────────────────────────────────────────

function TabGeldstroom({ data }: { data: WeeklyCashflowItem[] }) {
  if (!data || data.length === 0) {
    return <EmptyState message="Nog geen cashflow data beschikbaar." />;
  }

  const sorted = [...data].sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(-8);
  const totalIncome = sorted.reduce((a, c) => a + c.income_cents, 0);
  const totalExpenses = sorted.reduce((a, c) => a + c.expenses_cents, 0);
  const net = totalIncome - totalExpenses;

  const chartData = sorted.map(w => ({
    week: `Wk ${getWeekNumber(w.week_start)}`,
    Inkomen: w.income_cents,
    Uitgaven: w.expenses_cents,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Inkomen', value: totalIncome, color: 'text-pw-green' },
          { label: 'Uitgaven', value: totalExpenses, color: 'text-pw-red' },
          { label: 'Netto', value: net, color: net >= 0 ? 'text-pw-green' : 'text-pw-red' },
        ].map(m => (
          <div key={m.label} className="rounded-[10px] border border-pw-border bg-pw-surface p-2.5 text-center">
            <p className="text-[10px] text-pw-muted">{m.label}</p>
            <p className={`text-[14px] font-bold ${m.color}`}>{formatCents(Math.abs(m.value))}</p>
          </div>
        ))}
      </div>

      <div className="rounded-card border border-pw-border bg-pw-surface p-3">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barCategoryGap="25%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-pw-border" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} className="fill-pw-muted" axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `€${Math.round(v / 100)}`} tick={{ fontSize: 9 }} className="fill-pw-muted" axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Inkomen" fill="#059669" radius={[4, 4, 0, 0]} opacity={0.9} />
            <Bar dataKey="Uitgaven" fill="#2563EB" radius={[4, 4, 0, 0]} opacity={0.9} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-5 mt-2">
          {[['Inkomen', '#059669'], ['Uitgaven', '#2563EB']].map(([l, c]) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ background: c as string }} />
              <span className="text-[10px] text-pw-muted">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Trend ───────────────────────────────────────────────

function TabTrend({ data }: { data: MonthlyTotalItem[] }) {
  if (!data || data.length < 2) {
    return <EmptyState message="Minimaal 2 maanden data nodig voor trends." />;
  }

  const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const diff = last.expenses_cents - prev.expenses_cents;

  const avg = Math.round(sorted.reduce((a, c) => a + c.expenses_cents, 0) / sorted.length);

  const chartData = sorted.map(m => ({
    month: new Date(m.month + 'T00:00:00').toLocaleDateString('nl-NL', { month: 'short' }),
    Uitgaven: m.expenses_cents,
    Gemiddelde: avg,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <p className="text-[11px] text-pw-muted">
          {new Date(last.month + 'T00:00:00').toLocaleDateString('nl-NL', { month: 'long' })} vs{' '}
          {new Date(prev.month + 'T00:00:00').toLocaleDateString('nl-NL', { month: 'long' })}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {diff > 0 ? (
            <TrendingUp className="h-5 w-5 text-pw-red" strokeWidth={1.5} />
          ) : (
            <TrendingDown className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
          )}
          <p className={`text-[20px] font-bold ${diff > 0 ? 'text-pw-red' : 'text-pw-green'}`}>
            {diff > 0 ? '+' : ''}{formatCents(diff)}
          </p>
        </div>
        <p className="text-[11px] text-pw-muted mt-1">
          {diff > 0 ? 'Meer uitgegeven' : 'Minder uitgegeven'} dan vorige maand
        </p>
      </div>

      <div className="rounded-card border border-pw-border bg-pw-surface p-3">
        <p className="text-[11px] text-pw-muted mb-2 px-1">Uitgaven per maand</p>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-pw-border" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-pw-muted" axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `€${Math.round(v / 100)}`} tick={{ fontSize: 9 }} className="fill-pw-muted" axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Gemiddelde" stroke="#94A3B8" strokeWidth={1} strokeDasharray="4 4" fill="none" dot={false} />
            <Area type="monotone" dataKey="Uitgaven" stroke="#3B82F6" strokeWidth={2}
              fill="url(#areaGrad)" dot={{ fill: '#3B82F6', r: 3, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-center text-[10px] text-pw-muted mt-1">
          --- Gemiddelde {formatCents(avg)}/mnd
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Schuld ──────────────────────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  factuur: { label: 'Factuur', color: '#64748B', order: 0 },
  herinnering: { label: 'Herinnering', color: '#059669', order: 1 },
  aanmaning: { label: 'Aanmaning', color: '#D97706', order: 2 },
  incasso: { label: 'Incasso', color: '#DC2626', order: 3 },
  deurwaarder: { label: 'Deurwaarder', color: '#991B1B', order: 4 },
};

function TabSchuld({ debts, totals }: { debts: DebtItem[]; totals: MonthlyTotalItem[] }) {
  const totalDebt = debts.reduce((a, d) => a + d.amount, 0);

  // Calculate debt ratio from latest month
  const latestMonth = totals.length > 0 ? totals[0] : null;
  const debtPayments = latestMonth?.debt_payments_cents || 0;
  const totalExpenses = latestMonth?.expenses_cents || 1;
  const debtRatio = Math.round((debtPayments / totalExpenses) * 100);

  // Sort debts by escalation severity
  const sortedDebts = [...debts].sort((a, b) => {
    const aOrder = STAGE_CONFIG[a.escalation_stage]?.order ?? 0;
    const bOrder = STAGE_CONFIG[b.escalation_stage]?.order ?? 0;
    return bOrder - aOrder;
  });

  // Calculate months to freedom
  const avgMonthlyPayment = totals.length >= 2
    ? Math.round(totals.slice(0, 3).reduce((a, t) => a + t.debt_payments_cents, 0) / Math.min(totals.length, 3))
    : 0;
  const monthsToFreedom = avgMonthlyPayment > 0 ? Math.ceil(totalDebt / avgMonthlyPayment) : null;

  // Flexible spending (non-fixed categories)
  const latestCategories = totals.length > 0 ? totalExpenses - debtPayments : 0;

  if (debts.length === 0 && debtPayments === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <Target className="mb-3 h-12 w-12 text-pw-green/40" strokeWidth={1.2} />
        <h3 className="text-[16px] font-bold text-pw-green">Geen openstaande schulden</h3>
        <p className="mt-1 text-[12px] text-pw-muted">Je hebt op dit moment geen achterstallige rekeningen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header metric */}
      <div className="rounded-card-lg border border-pw-red/20 bg-gradient-to-br from-red-50/50 to-white dark:from-red-950/20 dark:to-pw-surface p-4">
        <p className="text-[11px] text-pw-muted">Totale schuld</p>
        <p className="text-[26px] font-extrabold text-pw-navy tracking-tight">{formatCents(totalDebt)}</p>
        {debtRatio > 0 && (
          <>
            <p className="text-[12px] text-pw-muted mt-2">
              <span className="text-pw-amber font-semibold">{debtRatio}%</span> van je uitgaven gaat naar schuldaflossing
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-pw-border/60 overflow-hidden">
              <div className="h-full rounded-full bg-pw-amber transition-all duration-700" style={{ width: `${Math.min(debtRatio, 100)}%` }} />
            </div>
          </>
        )}
        {monthsToFreedom && (
          <p className="mt-3 text-[12px] text-pw-muted">
            Schuldenvrij in{' '}
            <span className="font-bold text-pw-green">~{monthsToFreedom} maanden</span>
            {' '}bij huidig tempo
          </p>
        )}
      </div>

      {/* Debt list */}
      <div className="space-y-2">
        {sortedDebts.map(d => {
          const stage = STAGE_CONFIG[d.escalation_stage] || STAGE_CONFIG.factuur;
          const today = new Date().toISOString().split('T')[0];
          const daysLeft = Math.ceil((new Date(d.due_date).getTime() - new Date(today).getTime()) / 86400000);
          const overdue = daysLeft < 0;

          return (
            <div key={d.id} className="rounded-card border border-pw-border bg-pw-surface p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-pw-text truncate">{d.vendor}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: stage.color }}>
                    {stage.label} &middot;{' '}
                    {overdue ? (
                      <span className="text-pw-red">{Math.abs(daysLeft)}d verlopen</span>
                    ) : (
                      <span>nog {daysLeft}d</span>
                    )}
                  </p>
                </div>
              </div>
              <p className="text-[14px] font-bold ml-2" style={{ color: stage.color }}>{formatCents(d.amount)}</p>
            </div>
          );
        })}
      </div>

      {/* AI insight card */}
      {avgMonthlyPayment > 0 && (
        <div className="rounded-card border border-pw-green/20 bg-gradient-to-br from-green-50/50 to-white dark:from-green-950/20 dark:to-pw-surface p-4">
          <p className="text-[12px] font-bold text-pw-green mb-1">Inzicht</p>
          <p className="text-[12px] text-pw-muted leading-relaxed">
            Je betaalt gemiddeld <strong className="text-pw-text">{formatCents(avgMonthlyPayment)}</strong> per maand aan schulden.
            {monthsToFreedom && monthsToFreedom > 3 && (
              <> Als je <strong className="text-pw-text">{formatCents(Math.round(avgMonthlyPayment * 0.25))}</strong> extra per maand aflost,
              ben je <strong className="text-pw-green">~{Math.ceil(totalDebt / (avgMonthlyPayment * 1.25))} maanden</strong> eerder schuldenvrij.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <Wallet className="mb-3 h-10 w-10 text-pw-muted/30" strokeWidth={1.2} />
      <p className="text-[13px] text-pw-muted">{message}</p>
    </div>
  );
}

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
