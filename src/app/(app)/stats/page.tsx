'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  TrendingUp,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Zap,
  Shield,
  Clock,
  Flame,
  Target,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { type Bill, formatCents } from '@/lib/bills';
import { calculateWIKCosts } from '@/lib/wik';

type SubTab = 'performance' | 'ai';

interface Insight {
  type: 'priority' | 'warning' | 'pattern' | 'tip';
  title: string;
  description: string;
  bill_id: string | null;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

const URGENCY_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  critical: { border: 'border-pw-red/30', bg: 'bg-red-50/50', icon: 'text-pw-red' },
  high: { border: 'border-pw-orange/30', bg: 'bg-orange-50/50', icon: 'text-pw-orange' },
  medium: { border: 'border-pw-amber/30', bg: 'bg-amber-50/50', icon: 'text-pw-amber' },
  low: { border: 'border-pw-blue/30', bg: 'bg-blue-50/50', icon: 'text-pw-blue' },
};

export default function StatsPage() {
  const t = useTranslations('stats');
  const [activeTab, setActiveTab] = useState<SubTab>('performance');
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
    { key: 'performance', label: t('performance') },
    { key: 'ai', label: t('aiInsight') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>

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
        <div className="space-y-3">
          <div className="skeleton h-[180px] rounded-card" />
          <div className="grid grid-cols-2 gap-2">
            <div className="skeleton h-[90px] rounded-card" />
            <div className="skeleton h-[90px] rounded-card" />
          </div>
        </div>
      ) : activeTab === 'performance' ? (
        <PerformanceTab bills={bills} t={t} />
      ) : (
        <AiInsightsTab bills={bills} t={t} />
      )}
    </div>
  );
}

/* ============================================================
   PERFORMANCE TAB
   ============================================================ */
function PerformanceTab({ bills, t }: { bills: Bill[]; t: ReturnType<typeof useTranslations> }) {
  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Target className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
        <h2 className="text-[16px] font-semibold text-pw-text">{t('noData')}</h2>
        <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">{t('noDataHint')}</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const settled = bills.filter((b) => b.status === 'settled');
  const outstanding = bills.filter((b) => b.status !== 'settled');
  const overdue = outstanding.filter((b) => b.due_date < today);
  const escalated = outstanding.filter((b) => b.escalation_stage !== 'factuur');

  // On-time payment rate
  const onTimePaid = settled.filter((b) => b.paid_date && b.due_date && b.paid_date <= b.due_date);
  const onTimeRate = settled.length > 0 ? Math.round((onTimePaid.length / settled.length) * 100) : 0;

  // Payment streak (consecutive on-time payments, most recent first)
  const sortedSettled = [...settled]
    .filter((b) => b.paid_date)
    .sort((a, b) => (b.paid_date || '').localeCompare(a.paid_date || ''));
  let streak = 0;
  for (const bill of sortedSettled) {
    if (bill.paid_date && bill.due_date && bill.paid_date <= bill.due_date) {
      streak++;
    } else {
      break;
    }
  }

  // Savings from on-time payment
  const savedCents = onTimePaid.reduce((sum, b) => sum + calculateWIKCosts(b.amount), 0);

  // Health score (0-100)
  let healthScore = 50;
  if (bills.length > 0) {
    const onTimeBonus = onTimeRate * 0.4; // 40% weight
    const noOverdueBonus = overdue.length === 0 ? 30 : Math.max(0, 30 - overdue.length * 10);
    const noEscalationBonus = escalated.length === 0 ? 30 : Math.max(0, 30 - escalated.length * 15);
    healthScore = Math.min(100, Math.round(onTimeBonus + noOverdueBonus + noEscalationBonus));
  }

  const healthColor = healthScore >= 70 ? 'text-pw-green' : healthScore >= 40 ? 'text-pw-amber' : 'text-pw-red';
  const healthBg = healthScore >= 70 ? 'from-green-50' : healthScore >= 40 ? 'from-amber-50' : 'from-red-50';
  const healthLabel = healthScore >= 70 ? t('healthGood') : healthScore >= 40 ? t('healthOk') : t('healthBad');

  // Category breakdown
  const categoryTotals: Record<string, { total: number; count: number }> = {};
  for (const bill of outstanding) {
    const cat = bill.category || 'overig';
    if (!categoryTotals[cat]) categoryTotals[cat] = { total: 0, count: 0 };
    categoryTotals[cat].total += bill.amount;
    categoryTotals[cat].count++;
  }
  const categories = Object.entries(categoryTotals)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);
  const maxCategoryTotal = categories[0]?.total || 1;

  return (
    <div className="space-y-4">
      {/* Health Score Card */}
      <div className={`rounded-card-lg border border-pw-border bg-gradient-to-br ${healthBg} to-white p-5`}>
        <div className="flex items-center gap-5">
          {/* Score circle */}
          <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48" cy="48" r="40"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="8"
              />
              <circle
                cx="48" cy="48" r="40"
                fill="none"
                stroke={healthScore >= 70 ? '#059669' : healthScore >= 40 ? '#D97706' : '#DC2626'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(healthScore / 100) * 251.2} 251.2`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-[28px] font-extrabold ${healthColor}`}>
                {healthScore}
              </span>
            </div>
          </div>

          {/* Score info */}
          <div className="flex-1">
            <p className="text-[11px] font-medium text-pw-muted">{t('healthScore')}</p>
            <p className={`text-[18px] font-bold ${healthColor}`}>{healthLabel}</p>
            <p className="mt-1 text-[12px] text-pw-muted">{t('healthDescription')}</p>
          </div>
        </div>
      </div>

      {/* Metric cards (2x2) */}
      <div className="grid grid-cols-2 gap-2">
        {/* On-time rate */}
        <div className="stat-card before:bg-pw-green bg-gradient-to-br from-green-50 to-white px-3.5 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
            <p className="text-[11px] font-medium text-pw-muted">{t('onTimeRate')}</p>
          </div>
          <p className="mt-1 text-[24px] font-extrabold text-pw-green">{onTimeRate}%</p>
          <p className="text-[10px] text-pw-muted">
            {onTimePaid.length}/{settled.length} {t('onTimeOf')}
          </p>
        </div>

        {/* Payment streak */}
        <div className="stat-card before:bg-pw-blue bg-gradient-to-br from-blue-50 to-white px-3.5 py-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
            <p className="text-[11px] font-medium text-pw-muted">{t('streak')}</p>
          </div>
          <p className="mt-1 text-[24px] font-extrabold text-pw-blue">{streak}</p>
          <p className="text-[10px] text-pw-muted">{t('streakConsecutive')}</p>
        </div>

        {/* Savings */}
        <div className="stat-card before:bg-pw-green bg-gradient-to-br from-green-50 to-white px-3.5 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
            <p className="text-[11px] font-medium text-pw-muted">{t('saved')}</p>
          </div>
          <p className="mt-1 text-[20px] font-extrabold text-pw-green">{formatCents(savedCents)}</p>
          <p className="text-[10px] text-pw-muted">{t('savedDesc')}</p>
        </div>

        {/* Overdue */}
        <div className={`stat-card ${overdue.length > 0 ? 'before:bg-pw-red' : 'before:bg-pw-border'} bg-gradient-to-br ${overdue.length > 0 ? 'from-red-50' : 'from-gray-50'} to-white px-3.5 py-3`}>
          <div className="flex items-center gap-2">
            {overdue.length > 0 ? (
              <XCircle className="h-4 w-4 text-pw-red" strokeWidth={1.5} />
            ) : (
              <Clock className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
            )}
            <p className="text-[11px] font-medium text-pw-muted">{t('overdue')}</p>
          </div>
          <p className={`mt-1 text-[24px] font-extrabold ${overdue.length > 0 ? 'text-pw-red' : 'text-pw-muted'}`}>
            {overdue.length}
          </p>
          <p className="text-[10px] text-pw-muted">
            {overdue.length === 0 ? t('overdueNone') : t('overdueAction')}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <h3 className="mb-3 text-[14px] font-bold text-pw-navy">{t('byCategory')}</h3>
          <div className="space-y-3">
            {categories.slice(0, 6).map((cat) => (
              <div key={cat.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-pw-text">{cat.name}</span>
                  <span className="text-[12px] font-bold text-pw-navy">{formatCents(cat.total)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-pw-blue transition-all duration-500"
                    style={{ width: `${(cat.total / maxCategoryTotal) * 100}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[10px] text-pw-muted">
                  {cat.count} {cat.count === 1 ? t('bill') : t('bills')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escalation warning */}
      {escalated.length > 0 && (
        <div className="rounded-card border border-pw-red/20 bg-red-50/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-pw-red" strokeWidth={1.5} />
            <h3 className="text-[14px] font-bold text-pw-red">{t('escalated')}</h3>
          </div>
          <div className="space-y-2">
            {escalated.slice(0, 3).map((bill) => (
              <div key={bill.id} className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-pw-text">{bill.vendor}</span>
                <span className="text-[12px] font-bold text-pw-red">{formatCents(bill.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick summary */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <h3 className="mb-2 text-[14px] font-bold text-pw-navy">{t('summary')}</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[20px] font-extrabold text-pw-navy">{bills.length}</p>
            <p className="text-[10px] text-pw-muted">{t('totalBills')}</p>
          </div>
          <div>
            <p className="text-[20px] font-extrabold text-pw-blue">{formatCents(outstanding.reduce((s, b) => s + b.amount, 0))}</p>
            <p className="text-[10px] text-pw-muted">{t('totalOpen')}</p>
          </div>
          <div>
            <p className="text-[20px] font-extrabold text-pw-green">{formatCents(settled.reduce((s, b) => s + b.amount, 0))}</p>
            <p className="text-[10px] text-pw-muted">{t('totalPaid')}</p>
          </div>
        </div>
      </div>
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
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed');
      }

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

      {loading && (
        <div className="flex flex-col items-center py-12 text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-pw-purple" strokeWidth={1.5} />
          <p className="text-[14px] font-medium text-pw-muted">{t('analyzing')}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-input border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} />
          <p className="text-label text-pw-red">{error}</p>
        </div>
      )}

      {hasAnalyzed && !loading && (
        <>
          {summary && (
            <div className="rounded-card border border-pw-purple/20 bg-purple-50/30 px-4 py-3">
              <p className="text-[13px] font-medium text-pw-text">{summary}</p>
            </div>
          )}

          <div className="space-y-2">
            {insights.map((insight, i) => {
              const style = URGENCY_STYLES[insight.urgency] || URGENCY_STYLES.low;
              return (
                <div key={i} className={`rounded-card border ${style.border} ${style.bg} px-4 py-3`}>
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
