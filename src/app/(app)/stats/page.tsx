'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useMessages } from 'next-intl';
import {
  TrendingUp, Loader2, AlertTriangle, AlertCircle, Zap, Shield, Clock,
  Flame, Target, CheckCircle2, XCircle, Users, Share2, Copy, Check,
} from 'lucide-react';
import { type Bill, formatCents } from '@/lib/bills';
import { calculateWIKCosts } from '@/lib/wik';
import CashflowPanel from '@/components/cashflow-panel';
import MetricCard from '@/components/metric-card';
import { useDashboardModules } from '@/lib/dashboard-modules';

type SubTab = 'performance' | 'cashflow';

const ADMIN_EMAILS = ['sambajarju2@gmail.com', 'ayeitssamba@gmail.com', 'reiskenners@gmail.com'];

export default function StatsPage() {
  const t = useTranslations('stats');
  const [activeTab, setActiveTab] = useState<SubTab>('performance');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsUnlocked, setStatsUnlocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { modules } = useDashboardModules();

  useEffect(() => {
    async function load() {
      try {
        const [billsRes, profileRes] = await Promise.all([
          fetch('/api/bills'),
          fetch('/api/settings/profile'),
        ]);
        if (billsRes.ok) { const d = await billsRes.json(); setBills(d.bills || []); }
        if (profileRes.ok) {
          const d = await profileRes.json();
          setStatsUnlocked(d.profile?.stats_unlocked || false);
          if (d.profile?.email && ADMIN_EMAILS.includes(d.profile.email.toLowerCase())) setIsAdmin(true);
        }
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [ADMIN_EMAILS]);

  const canSeeFullStats = true;
  const tabs: { key: SubTab; label: string }[] = [
    { key: 'performance', label: t('performance') },
    { key: 'cashflow', label: 'Cashflow' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>
      <div className="flex gap-1.5 rounded-input bg-pw-border/50 p-1">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-[6px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${activeTab === tab.key ? 'bg-pw-surface text-pw-text shadow-sm' : 'text-pw-muted hover:text-pw-text'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3"><div className="skeleton h-[180px] rounded-card" /><div className="grid grid-cols-2 gap-2"><div className="skeleton h-[90px] rounded-[14px]" /><div className="skeleton h-[90px] rounded-[14px]" /></div></div>
      ) : activeTab === 'performance' ? (
        <PerformanceTab bills={bills} t={t} canSeeFullStats={canSeeFullStats} onUnlocked={() => setStatsUnlocked(true)} showCategory={modules.stats_category} />
      ) : (
        <CashflowPanel bills={bills} statsUnlocked={canSeeFullStats} />
      )}
    </div>
  );
}

/* ============================================================
   PERFORMANCE TAB — Health card visible, rest blurred unless unlocked
   ============================================================ */
function PerformanceTab({ bills, t, canSeeFullStats, onUnlocked, showCategory }: { bills: Bill[]; t: ReturnType<typeof useTranslations>; canSeeFullStats: boolean; onUnlocked: () => void; showCategory: boolean }) {
  if (bills.length === 0) {
    return (<div className="flex flex-col items-center py-16 text-center"><Target className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} /><h2 className="text-[16px] font-semibold text-pw-text">{t('noData')}</h2><p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">{t('noDataHint')}</p></div>);
  }

  const today = new Date().toISOString().split('T')[0];
  const settled = bills.filter((b) => b.status === 'settled');
  const outstanding = bills.filter((b) => b.status !== 'settled');
  const overdue = outstanding.filter((b) => b.due_date < today);
  const escalated = outstanding.filter((b) => b.escalation_stage !== 'factuur');
  const onTimePaid = settled.filter((b) => b.paid_date && b.due_date && b.paid_date <= b.due_date);
  const onTimeRate = settled.length > 0 ? Math.round((onTimePaid.length / settled.length) * 100) : 0;

  const sortedSettled = [...settled].filter((b) => b.paid_date).sort((a, b) => (b.paid_date || '').localeCompare(a.paid_date || ''));
  let streak = 0;
  for (const bill of sortedSettled) { if (bill.paid_date && bill.due_date && bill.paid_date <= bill.due_date) streak++; else break; }
  const savedCents = onTimePaid.reduce((sum, b) => sum + calculateWIKCosts(b.amount), 0);

  let healthScore = 50;
  if (bills.length > 0) {
    const onTimeBonus = onTimeRate * 0.4;
    const noOverdueBonus = overdue.length === 0 ? 30 : Math.max(0, 30 - overdue.length * 10);
    const noEscalationBonus = escalated.length === 0 ? 30 : Math.max(0, 30 - escalated.length * 15);
    healthScore = Math.min(100, Math.round(onTimeBonus + noOverdueBonus + noEscalationBonus));
  }

  const healthColor = healthScore >= 70 ? 'text-pw-green' : healthScore >= 40 ? 'text-pw-amber' : 'text-pw-red';
  const healthBg = healthScore >= 70 ? 'from-green-50' : healthScore >= 40 ? 'from-amber-50' : 'from-red-50';
  const healthLabel = healthScore >= 70 ? t('healthGood') : healthScore >= 40 ? t('healthOk') : t('healthBad');

  const categoryTotals: Record<string, { total: number; count: number }> = {};
  for (const bill of outstanding) { const cat = bill.category || 'overig'; if (!categoryTotals[cat]) categoryTotals[cat] = { total: 0, count: 0 }; categoryTotals[cat].total += bill.amount; categoryTotals[cat].count++; }
  const categories = Object.entries(categoryTotals).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total);
  const maxCategoryTotal = categories[0]?.total || 1;

  return (
    <div className="space-y-4">
      {/* Health Score — ALWAYS visible */}
      <div className={`rounded-card-lg border border-pw-border bg-gradient-to-br ${healthBg} to-white p-5`}>
        <div className="flex items-center gap-5">
          <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="40" fill="none" stroke="#E2E8F0" strokeWidth="8" />
              <circle cx="48" cy="48" r="40" fill="none" stroke={healthScore >= 70 ? '#059669' : healthScore >= 40 ? '#D97706' : '#DC2626'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(healthScore / 100) * 251.2} 251.2`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-[28px] font-extrabold ${healthColor}`}>{healthScore}</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-medium text-pw-muted">{t('healthScore')}</p>
            <p className={`text-[18px] font-bold ${healthColor}`}>{healthLabel}</p>
            <p className="mt-1 text-[12px] text-pw-muted">{t('healthDescription')}</p>
          </div>
        </div>
      </div>

      {canSeeFullStats ? (
        <FullPerformanceContent
          t={t} onTimeRate={onTimeRate} onTimePaid={onTimePaid} settled={settled}
          streak={streak} savedCents={savedCents} overdue={overdue} escalated={escalated}
          categories={categories} maxCategoryTotal={maxCategoryTotal} bills={bills}
          outstanding={outstanding} showCategory={showCategory}
        />
      ) : (
        <ReferralGate onUnlocked={onUnlocked} />
      )}
    </div>
  );
}

/* Referral invite gate with blur overlay */
function ReferralGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [referralCode, setReferralCode] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/referral');
        if (res.ok) {
          const data = await res.json();
          setReferralCode(data.referral_code || '');
          setShareUrl(data.share_url || '');
          if (data.stats_unlocked) onUnlocked();
        }
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [onUnlocked]);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: 'PayWatch', text: 'Probeer PayWatch — rust in je hoofd over elke rekening.', url: shareUrl }); } catch {}
    } else {
      handleCopy();
    }
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px] opacity-60">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[14px] border border-pw-border/60 bg-pw-surface p-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"><p className="text-[24px] font-extrabold text-pw-green">—%</p><p className="text-[10px] text-pw-muted">On-time rate</p></div>
          <div className="rounded-[14px] border border-pw-border/60 bg-pw-surface p-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"><p className="text-[24px] font-extrabold text-pw-blue">—</p><p className="text-[10px] text-pw-muted">Streak</p></div>
          <div className="rounded-[14px] border border-pw-border/60 bg-pw-surface p-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"><p className="text-[20px] font-extrabold text-pw-green">€ —</p><p className="text-[10px] text-pw-muted">Bespaard</p></div>
          <div className="rounded-[14px] border border-pw-border/60 bg-pw-surface p-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"><p className="text-[24px] font-extrabold text-pw-red">—</p><p className="text-[10px] text-pw-muted">Achterstallig</p></div>
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-4 w-full max-w-sm rounded-card-lg border-2 border-pw-blue/20 bg-pw-surface p-6 shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pw-blue/10 mb-3">
              <Users className="h-7 w-7 text-pw-blue" strokeWidth={1.5} />
            </div>
            <h3 className="text-[16px] font-bold text-pw-navy">Nodig een vriend uit</h3>
            <p className="mt-1 text-[12px] text-pw-muted leading-relaxed">
              Deel PayWatch met een vriend. Zodra zij een account aanmaken, krijgen jullie allebei toegang tot de volledige statistieken.
            </p>
            {!loading && referralCode && (
              <>
                <div className="mt-4 flex w-full items-center gap-2 rounded-input border border-pw-border bg-pw-bg px-3 py-2">
                  <span className="flex-1 text-[11px] font-mono text-pw-text truncate">{shareUrl}</span>
                  <button onClick={handleCopy} className="flex-shrink-0 text-pw-muted hover:text-pw-blue">
                    {copied ? <Check className="h-4 w-4 text-pw-green" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
                  </button>
                </div>
                <button onClick={handleShare}
                  className="btn-press mt-3 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
                  <Share2 className="h-4 w-4" strokeWidth={1.5} />
                  Deel met een vriend
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Full performance content (shown when unlocked) */
function FullPerformanceContent({ t, onTimeRate, onTimePaid, settled, streak, savedCents, overdue, escalated, categories, maxCategoryTotal, bills, outstanding, showCategory }: {
  t: ReturnType<typeof useTranslations>; onTimeRate: number; onTimePaid: Bill[]; settled: Bill[];
  streak: number; savedCents: number; overdue: Bill[]; escalated: Bill[];
  categories: Array<{ name: string; total: number; count: number }>; maxCategoryTotal: number;
  bills: Bill[]; outstanding: Bill[]; showCategory: boolean;
}) {
  const messages = useMessages();
  const catMap = (messages as Record<string, unknown>)?.addBill && typeof (messages as Record<string, unknown>).addBill === 'object'
    ? ((messages as Record<string, Record<string, unknown>>).addBill.categories as Record<string, string>) || {} : {};

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          icon={<CheckCircle2 className="h-[15px] w-[15px] text-pw-green" strokeWidth={1.8} />}
          label={t('onTimeRate')}
          value={`${onTimeRate}%`}
          sub={`${onTimePaid.length}/${settled.length} ${t('onTimeOf')}`}
          color="green"
          ring={{ value: onTimePaid.length, max: settled.length }}
        />
        <MetricCard
          icon={<Flame className="h-[15px] w-[15px] text-pw-blue" strokeWidth={1.8} />}
          label={t('streak')}
          value={String(streak)}
          sub={t('streakConsecutive')}
          color="blue"
        />
        <MetricCard
          icon={<Shield className="h-[15px] w-[15px] text-pw-green" strokeWidth={1.8} />}
          label={t('saved')}
          value={formatCents(savedCents)}
          sub={t('savedDesc')}
          color="green"
        />
        <MetricCard
          icon={overdue.length > 0
            ? <XCircle className="h-[15px] w-[15px] text-pw-red" strokeWidth={1.8} />
            : <Clock className="h-[15px] w-[15px] text-pw-muted" strokeWidth={1.8} />
          }
          label={t('overdue')}
          value={String(overdue.length)}
          sub={overdue.length === 0 ? t('overdueNone') : t('overdueAction')}
          color={overdue.length > 0 ? 'red' : 'green'}
        />
      </div>

      {showCategory && categories.length > 0 && (
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <h3 className="mb-3 text-[14px] font-bold text-pw-navy">{t('byCategory')}</h3>
          <div className="space-y-3">
            {categories.slice(0, 6).map((cat) => (
              <div key={cat.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-pw-text">{catMap[cat.name] || cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</span>
                  <span className="text-[12px] font-bold text-pw-navy">{formatCents(cat.total)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100"><div className="h-2 rounded-full bg-pw-blue transition-all duration-500" style={{ width: `${(cat.total / maxCategoryTotal) * 100}%` }} /></div>
                <p className="mt-0.5 text-[10px] text-pw-muted">{cat.count} {cat.count === 1 ? t('bill') : t('bills')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {escalated.length > 0 && (
        <div className="rounded-card border border-pw-red/20 bg-red-50/30 p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-pw-red" strokeWidth={1.5} /><h3 className="text-[14px] font-bold text-pw-red">{t('escalated')}</h3></div>
          <div className="space-y-2">{escalated.slice(0, 3).map((bill) => (<div key={bill.id} className="flex items-center justify-between"><span className="text-[12px] font-medium text-pw-text">{bill.vendor}</span><span className="text-[12px] font-bold text-pw-red">{formatCents(bill.amount)}</span></div>))}</div>
        </div>
      )}

      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <h3 className="mb-2 text-[14px] font-bold text-pw-navy">{t('summary')}</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="text-[20px] font-extrabold text-pw-navy">{bills.length}</p><p className="text-[10px] text-pw-muted">{t('totalBills')}</p></div>
          <div><p className="text-[20px] font-extrabold text-pw-blue">{formatCents(outstanding.reduce((s: number, b: Bill) => s + b.amount, 0))}</p><p className="text-[10px] text-pw-muted">{t('totalOpen')}</p></div>
          <div><p className="text-[20px] font-extrabold text-pw-green">{formatCents(settled.reduce((s: number, b: Bill) => s + b.amount, 0))}</p><p className="text-[10px] text-pw-muted">{t('totalPaid')}</p></div>
        </div>
      </div>
    </>
  );
}
