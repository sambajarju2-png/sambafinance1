'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, Camera, Mail, Plus, Shield, AlertTriangle, CreditCard, Clock, CalendarDays, CircleCheck } from 'lucide-react';
import { formatCents, type Bill } from '@/lib/bills';
import { calculateWIKCosts } from '@/lib/wik';
import { useRouter } from 'next/navigation';
import MoodTracker from '@/components/mood-tracker';
import AchievementsDisplay from '@/components/achievements';
import AiInsightsPanel from '@/components/ai-insights';
import SchuldenvrijCountdown from '@/components/schuldenvrij-countdown';
import MetricCard from '@/components/metric-card';

type OverzichtTab = 'overview' | 'ai';

export default function OverzichtPage() {
  const t = useTranslations('dashboard');
  const router = useRouter();

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OverzichtTab>('overview');

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

    // Recalculate streak in background
    fetch('/api/streak').catch(() => {});
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const threeDaysFromNow = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  const outstanding = bills.filter((b) => b.status !== 'settled');
  const overdue = outstanding.filter((b) => b.due_date < today);
  const upcoming = outstanding.filter(
    (b) => b.due_date >= today && b.due_date <= threeDaysFromNow
  );
  const settled = bills.filter((b) => b.status === 'settled');

  const outstandingTotal = outstanding.reduce((sum, b) => sum + b.amount, 0);
  const settledTotal = settled.reduce((sum, b) => sum + b.amount, 0);

  const escalated = outstanding.filter((b) => b.escalation_stage && b.escalation_stage !== 'factuur');

  const savedCents = settled
    .filter((b) => b.paid_date && b.due_date && b.paid_date <= b.due_date)
    .reduce((sum, b) => sum + calculateWIKCosts(b.amount), 0);

  const tabs: { key: OverzichtTab; label: string }[] = [
    { key: 'overview', label: t('tabOverview') },
    { key: 'ai', label: t('tabAiInsight') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>

      {/* Sub-tab toggle */}
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

      {activeTab === 'overview' ? (
        <>
          {/* Stat cards (2x2) */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-[90px] rounded-[14px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <MetricCard
                icon={<CreditCard className="h-[15px] w-[15px] text-pw-blue" strokeWidth={1.8} />}
                label={t('outstanding')}
                value={formatCents(outstandingTotal)}
                sub={`${outstanding.length} ${outstanding.length === 1 ? t('billSingular') : t('billPlural')}`}
                color="blue"
              />
              <MetricCard
                icon={<Clock className="h-[15px] w-[15px] text-pw-red" strokeWidth={1.8} />}
                label={t('overdue')}
                value={String(overdue.length)}
                sub={overdue.length === 0 ? t('onTrack') : t('payNow')}
                color={overdue.length > 0 ? 'red' : 'green'}
              />
              <MetricCard
                icon={<CalendarDays className="h-[15px] w-[15px] text-amber-600" strokeWidth={1.8} />}
                label={t('upcoming')}
                value={String(upcoming.length)}
                sub={t('withinSevenDays')}
                color="amber"
              />
              <MetricCard
                icon={<CircleCheck className="h-[15px] w-[15px] text-pw-green" strokeWidth={1.8} />}
                label={t('paid')}
                value={formatCents(settledTotal)}
                sub={t('thisMonth')}
                color="green"
              />
            </div>
          )}

          {/* Mijn schulden card */}
          {!loading && outstanding.length > 0 && (
            <div className="rounded-card border border-pw-border bg-pw-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-pw-muted">{t('debtCard')}</p>
                  <p className="mt-0.5 text-[24px] font-extrabold text-pw-navy">
                    {formatCents(outstandingTotal)}
                  </p>
                </div>
                {escalated.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-[4px] bg-red-50 px-2 py-1">
                    <AlertTriangle className="h-3 w-3 text-pw-red" strokeWidth={2} />
                    <span className="text-[11px] font-semibold text-pw-red">
                      {escalated.length} {t('inEscalation')}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-pw-border pt-3">
                <Shield className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
                <span className="text-[13px] font-semibold text-pw-green">
                  {savedCents > 0
                    ? `${formatCents(savedCents)} ${t('savedOnCollection')}`
                    : t('payOnTimeToSave')}
                </span>
              </div>
            </div>
          )}

          {/* Schuldenvrij countdown */}
          {!loading && <SchuldenvrijCountdown bills={bills} />}

          {/* Quick actions */}
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/scan')}
              className="btn-press flex flex-1 items-center justify-center gap-2 rounded-card border border-pw-border bg-pw-surface px-3 py-3 text-[13px] font-semibold text-pw-text"
            >
              <Camera className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
              {t('scanBill')}
            </button>
            <button
              onClick={() => router.push('/instellingen?tab=gmail')}
              className="btn-press flex flex-1 items-center justify-center gap-2 rounded-card border border-pw-border bg-pw-surface px-3 py-3 text-[13px] font-semibold text-pw-text"
            >
              <Mail className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
              {t('scanEmail')}
            </button>
          </div>

          {/* Overdue bills */}
          {overdue.length > 0 && (
            <div>
              <h2 className="mb-2 text-[16px] font-bold text-pw-navy">{t('overdueSection')}</h2>
              <div className="space-y-2">
                {overdue.slice(0, 3).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between rounded-card border border-pw-red/20 bg-red-50/50 px-3.5 py-3"
                  >
                    <div>
                      <p className="text-[14px] font-semibold text-pw-text">{bill.vendor}</p>
                      <p className="text-[11px] text-pw-red">
                        {new Date(bill.due_date + 'T00:00:00').toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <p className="text-[15px] font-bold text-pw-red">{formatCents(bill.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements */}
          <AchievementsDisplay />

          {/* Mood tracker */}
          <MoodTracker />

          {/* Empty state */}
          {!loading && bills.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <LayoutDashboard className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
              <h2 className="text-[16px] font-semibold text-pw-text">{t('noBillsTitle')}</h2>
              <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">
                {t('noBillsDescription')}
              </p>
            </div>
          )}
        </>
      ) : (
        /* AI Inzicht tab */
        <AiInsightsPanel bills={bills} />
      )}
    </div>
  );
}
