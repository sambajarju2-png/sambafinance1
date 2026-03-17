'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  TrendingUp,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Zap,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { type Bill, formatCents } from '@/lib/bills';

type SubTab = 'charts' | 'ai';

interface Insight {
  type: 'priority' | 'warning' | 'pattern' | 'tip';
  title: string;
  description: string;
  bill_id: string | null;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

const CATEGORY_COLORS: Record<string, string> = {
  energie: '#2563EB',
  water: '#2563EB',
  internet: '#059669',
  telefoon: '#059669',
  verzekering: '#D97706',
  huur: '#2563EB',
  belasting: '#D97706',
  zorg: '#059669',
  abonnement: '#D97706',
  overig: '#64748B',
};

const URGENCY_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  critical: { border: 'border-pw-red/30', bg: 'bg-red-50/50', icon: 'text-pw-red' },
  high: { border: 'border-pw-orange/30', bg: 'bg-orange-50/50', icon: 'text-pw-orange' },
  medium: { border: 'border-pw-amber/30', bg: 'bg-amber-50/50', icon: 'text-pw-amber' },
  low: { border: 'border-pw-blue/30', bg: 'bg-blue-50/50', icon: 'text-pw-blue' },
};

export default function StatsPage() {
  const t = useTranslations('stats');

  const [activeTab, setActiveTab] = useState<SubTab>('charts');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBills() {
      try {
        const res = await fetch('/api/bills');
        if (res.ok) {
          const data = await res.json();
          setBills(data.bills || []);
        }
      } catch {
        console.error('Failed to fetch bills');
      } finally {
        setLoading(false);
      }
    }
    fetchBills();
  }, []);

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'charts', label: t('charts') },
    { key: 'ai', label: t('aiInsight') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>

      {/* Sub-tabs */}
      <div className="flex gap-1.5 rounded-input bg-pw-border/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-[6px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-pw-surface text-pw-text shadow-sm'
                : 'text-pw-muted hover:text-pw-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-[200px] rounded-card" />
          <div className="skeleton h-[80px] rounded-card" />
        </div>
      ) : activeTab === 'charts' ? (
        <ChartsTab bills={bills} t={t} />
      ) : (
        <AiInsightsTab bills={bills} t={t} />
      )}
    </div>
  );
}

/* ============================================================
   CHARTS TAB
   ============================================================ */
function ChartsTab({ bills, t }: { bills: Bill[]; t: ReturnType<typeof useTranslations> }) {
  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <BarChart3 className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
        <h2 className="text-[16px] font-semibold text-pw-text">{t('noData')}</h2>
        <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">{t('noDataHint')}</p>
      </div>
    );
  }

  // Spending by category (outstanding + action bills)
  const activeBills = bills.filter((b) => b.status !== 'settled');
  const categoryTotals: Record<string, number> = {};

  for (const bill of activeBills) {
    const cat = bill.category || 'overig';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + bill.amount;
  }

  const chartData = Object.entries(categoryTotals)
    .map(([category, total]) => ({
      category,
      total: total / 100,
      color: CATEGORY_COLORS[category] || '#64748B',
    }))
    .sort((a, b) => b.total - a.total);

  // Totals
  const totalOutstanding = activeBills.reduce((s, b) => s + b.amount, 0);
  const totalSettled = bills.filter((b) => b.status === 'settled').reduce((s, b) => s + b.amount, 0);
  const totalBills = bills.length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-card border border-pw-border bg-pw-surface p-3 text-center">
          <p className="text-[11px] font-medium text-pw-muted">{t('totalBills')}</p>
          <p className="mt-0.5 text-[20px] font-extrabold text-pw-navy">{totalBills}</p>
        </div>
        <div className="rounded-card border border-pw-border bg-pw-surface p-3 text-center">
          <p className="text-[11px] font-medium text-pw-muted">{t('totalOpen')}</p>
          <p className="mt-0.5 text-[16px] font-extrabold text-pw-blue">{formatCents(totalOutstanding)}</p>
        </div>
        <div className="rounded-card border border-pw-border bg-pw-surface p-3 text-center">
          <p className="text-[11px] font-medium text-pw-muted">{t('totalPaid')}</p>
          <p className="mt-0.5 text-[16px] font-extrabold text-pw-green">{formatCents(totalSettled)}</p>
        </div>
      </div>

      {/* Spending by category chart */}
      {chartData.length > 0 && (
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <h3 className="mb-3 text-[14px] font-bold text-pw-navy">{t('byCategory')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `€${v}`}
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 12, fill: '#0F172A', fontWeight: 500 }}
                width={90}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [`€${value.toFixed(2)}`, '']}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={24}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Escalation breakdown */}
      {(() => {
        const escalated = bills.filter(
          (b) => b.status !== 'settled' && b.escalation_stage !== 'factuur'
        );
        if (escalated.length === 0) return null;

        return (
          <div className="rounded-card border border-pw-red/20 bg-red-50/30 p-4">
            <h3 className="mb-2 text-[14px] font-bold text-pw-red">{t('escalated')}</h3>
            <p className="text-[13px] text-pw-muted">
              {t('escalatedCount', { count: escalated.length })}
            </p>
            <div className="mt-2 space-y-1">
              {escalated.slice(0, 3).map((bill) => (
                <div key={bill.id} className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-pw-text">{bill.vendor}</span>
                  <span className="font-semibold text-pw-red">{formatCents(bill.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ============================================================
   AI INSIGHTS TAB
   ============================================================ */
function AiInsightsTab({ bills, t }: { bills: Bill[]; t: ReturnType<typeof useTranslations> }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/insights', { method: 'POST' });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }

      const data = await res.json();
      setInsights(data.insights || []);
      setSummary(data.summary || '');
      setHasAnalyzed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneral'));
    } finally {
      setLoading(false);
    }
  }

  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Zap className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
        <h2 className="text-[16px] font-semibold text-pw-text">{t('noData')}</h2>
        <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">{t('noDataHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Analyze button */}
      {!hasAnalyzed && !loading && (
        <div className="flex flex-col items-center rounded-card border border-dashed border-pw-purple/30 bg-purple-50/30 py-8 text-center">
          <Zap className="mb-3 h-10 w-10 text-pw-purple" strokeWidth={1.5} />
          <h2 className="text-[14px] font-semibold text-pw-text">{t('aiTitle')}</h2>
          <p className="mt-1 max-w-[260px] text-[12px] text-pw-muted">{t('aiDescription')}</p>
          <button
            onClick={handleAnalyze}
            className="btn-press mt-4 flex items-center gap-2 rounded-button bg-pw-purple px-6 py-2.5 text-[13px] font-semibold text-white"
          >
            <Zap className="h-4 w-4" strokeWidth={1.5} />
            {t('analyze')}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-12 text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-pw-purple" strokeWidth={1.5} />
          <p className="text-[14px] font-medium text-pw-muted">{t('analyzing')}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-input border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} />
          <p className="text-label text-pw-red">{error}</p>
        </div>
      )}

      {/* Results */}
      {hasAnalyzed && !loading && (
        <>
          {/* Summary */}
          {summary && (
            <div className="rounded-card border border-pw-purple/20 bg-purple-50/30 px-4 py-3">
              <p className="text-[13px] font-medium text-pw-text">{summary}</p>
            </div>
          )}

          {/* Insight cards */}
          <div className="space-y-2">
            {insights.map((insight, i) => {
              const style = URGENCY_STYLES[insight.urgency] || URGENCY_STYLES.low;

              return (
                <div
                  key={i}
                  className={`rounded-card border ${style.border} ${style.bg} px-4 py-3`}
                >
                  <div className="flex items-start gap-3">
                    {insight.type === 'priority' || insight.type === 'warning' ? (
                      <AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${style.icon}`} strokeWidth={1.5} />
                    ) : (
                      <Zap className={`mt-0.5 h-4 w-4 flex-shrink-0 ${style.icon}`} strokeWidth={1.5} />
                    )}
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-pw-text">{insight.title}</p>
                      <p className="mt-0.5 text-[12px] text-pw-muted">{insight.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Re-analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-button border border-pw-purple/30 bg-purple-50/30 px-4 py-2.5 text-[13px] font-semibold text-pw-purple disabled:opacity-50"
          >
            <Zap className="h-4 w-4" strokeWidth={1.5} />
            {t('reAnalyze')}
          </button>
        </>
      )}
    </div>
  );
}
