'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowDownUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ChevronRight,
  Clock,
  Wallet,
} from 'lucide-react';
import { type Bill, formatCents } from '@/lib/bills';

type ForecastPeriod = '7' | '14' | '30';

export default function CashflowPage() {
  const t = useTranslations('cashflow');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastDays, setForecastDays] = useState<ForecastPeriod>('14');
  const [statsUnlocked, setStatsUnlocked] = useState(false);

  const ADMIN_EMAILS = ['sambajarju2@gmail.com', 'ayeitssamba@gmail.com', 'reiskenners@gmail.com'];

  useEffect(() => {
    async function fetchData() {
      try {
        const [billsRes, profileRes] = await Promise.all([fetch('/api/bills'), fetch('/api/settings/profile')]);
        if (billsRes.ok) { const data = await billsRes.json(); setBills(data.bills || []); }
        if (profileRes.ok) {
          const d = await profileRes.json();
          setStatsUnlocked(d.profile?.stats_unlocked || false);
          if (d.profile?.email && ADMIN_EMAILS.includes(d.profile.email.toLowerCase())) setStatsUnlocked(true);
        }
      } catch { console.error('Failed to fetch'); } finally { setLoading(false); }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-7 w-32 rounded-input" />
        <div className="skeleton h-[140px] rounded-card" />
        <div className="skeleton h-[100px] rounded-card" />
        <div className="skeleton h-[200px] rounded-card" />
      </div>
    );
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Current month stats
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const thisMonthBills = bills.filter((b) => {
    const d = new Date(b.due_date + 'T00:00:00');
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const lastMonthBills = bills.filter((b) => {
    const d = new Date(b.due_date + 'T00:00:00');
    const lm = currentMonth === 0 ? 11 : currentMonth - 1;
    const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
    return d.getMonth() === lm && d.getFullYear() === ly;
  });

  const thisMonthTotal = thisMonthBills.reduce((s, b) => s + b.amount, 0);
  const lastMonthTotal = lastMonthBills.reduce((s, b) => s + b.amount, 0);
  const thisMonthPaid = thisMonthBills.filter((b) => b.status === 'settled').reduce((s, b) => s + b.amount, 0);
  const thisMonthRemaining = thisMonthTotal - thisMonthPaid;

  const monthDiff = lastMonthTotal > 0
    ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
    : 0;

  // Upcoming payments forecast
  const forecastEnd = new Date(today);
  forecastEnd.setDate(forecastEnd.getDate() + parseInt(forecastDays));
  const forecastEndStr = forecastEnd.toISOString().split('T')[0];

  const upcomingBills = bills
    .filter((b) => b.status !== 'settled' && b.due_date >= todayStr && b.due_date <= forecastEndStr)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const upcomingTotal = upcomingBills.reduce((s, b) => s + b.amount, 0);

  // Monthly history (last 6 months)
  const monthlyData: { label: string; total: number; paid: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const monthBills = bills.filter((b) => {
      const bd = new Date(b.due_date + 'T00:00:00');
      return bd.getMonth() === m && bd.getFullYear() === y;
    });
    const total = monthBills.reduce((s, b) => s + b.amount, 0);
    const paid = monthBills.filter((b) => b.status === 'settled').reduce((s, b) => s + b.amount, 0);
    monthlyData.push({
      label: d.toLocaleDateString('nl-NL', { month: 'short' }),
      total,
      paid,
    });
  }
  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1);

  // Top vendors
  const vendorTotals: Record<string, { total: number; count: number }> = {};
  for (const bill of bills.filter((b) => b.status !== 'settled')) {
    if (!vendorTotals[bill.vendor]) vendorTotals[bill.vendor] = { total: 0, count: 0 };
    vendorTotals[bill.vendor].total += bill.amount;
    vendorTotals[bill.vendor].count++;
  }
  const topVendors = Object.entries(vendorTotals)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const maxVendorTotal = topVendors[0]?.total || 1;

  if (bills.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-heading text-pw-navy">{t('title')}</h1>
        <div className="flex flex-col items-center py-16 text-center">
          <ArrowDownUp className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
          <h2 className="text-[16px] font-semibold text-pw-text">{t('noData')}</h2>
          <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">{t('noDataHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>

      {/* This Month Summary */}
      <div className="rounded-card-lg border border-pw-border bg-pw-surface p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium text-pw-muted">{t('thisMonth')}</p>
            <p className="mt-1 text-[28px] font-extrabold tracking-tight text-pw-navy">
              {formatCents(thisMonthTotal)}
            </p>
          </div>
          {monthDiff !== 0 && (
            <div className={`flex items-center gap-1 rounded-[4px] px-2 py-1 ${
              monthDiff > 0 ? 'bg-red-50 text-pw-red' : 'bg-green-50 text-pw-green'
            }`}>
              {monthDiff > 0 ? (
                <TrendingUp className="h-3 w-3" strokeWidth={2} />
              ) : (
                <TrendingDown className="h-3 w-3" strokeWidth={2} />
              )}
              <span className="text-[11px] font-semibold">
                {monthDiff > 0 ? '+' : ''}{monthDiff}%
              </span>
            </div>
          )}
          {monthDiff === 0 && lastMonthTotal > 0 && (
            <div className="flex items-center gap-1 rounded-[4px] bg-gray-50 px-2 py-1 text-pw-muted">
              <Minus className="h-3 w-3" strokeWidth={2} />
              <span className="text-[11px] font-semibold">0%</span>
            </div>
          )}
        </div>

        {/* Paid vs remaining bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-medium text-pw-green">{t('paid')}: {formatCents(thisMonthPaid)}</span>
            <span className="font-medium text-pw-muted">{t('remaining')}: {formatCents(thisMonthRemaining)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-3 rounded-full bg-pw-green transition-all duration-500"
              style={{ width: thisMonthTotal > 0 ? `${(thisMonthPaid / thisMonthTotal) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Upcoming Forecast */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
            <h3 className="text-[14px] font-bold text-pw-navy">{t('upcoming')}</h3>
          </div>
          {/* Period selector */}
          <div className="flex gap-1 rounded-[6px] bg-pw-border/50 p-0.5">
            {(['7', '14', '30'] as ForecastPeriod[]).map((d) => (
              <button
                key={d}
                onClick={() => setForecastDays(d)}
                className={`rounded-[4px] px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                  forecastDays === d
                    ? 'bg-pw-surface text-pw-text shadow-sm'
                    : 'text-pw-muted'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {upcomingBills.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-pw-muted">{t('noUpcoming')}</p>
        ) : (
          <>
            <div className="mb-3 rounded-input bg-pw-blue/5 px-3 py-2">
              <p className="text-[12px] text-pw-muted">{t('dueNext', { days: forecastDays })}</p>
              <p className="text-[20px] font-extrabold text-pw-blue">{formatCents(upcomingTotal)}</p>
            </div>
            <div className="space-y-2">
              {upcomingBills.slice(0, 5).map((bill) => (
                <div key={bill.id} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-pw-text">{bill.vendor}</p>
                    <p className="text-[10px] text-pw-muted">
                      {new Date(bill.due_date + 'T00:00:00').toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[13px] font-bold text-pw-navy">
                    {formatCents(bill.amount)}
                  </span>
                </div>
              ))}
              {upcomingBills.length > 5 && (
                <p className="text-center text-[11px] text-pw-muted">
                  +{upcomingBills.length - 5} {t('more')}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Monthly History */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
          <h3 className="text-[14px] font-bold text-pw-navy">{t('monthlyHistory')}</h3>
        </div>
        <div className="space-y-3">
          {monthlyData.map((month, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[12px] font-medium text-pw-text capitalize">{month.label}</span>
                <span className="text-[12px] font-bold text-pw-navy">
                  {month.total > 0 ? formatCents(month.total) : '-'}
                </span>
              </div>
              {month.total > 0 && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="flex h-2">
                    <div
                      className="h-2 rounded-l-full bg-pw-green transition-all duration-500"
                      style={{ width: `${(month.paid / maxMonthly) * 100}%` }}
                    />
                    <div
                      className="h-2 bg-pw-blue/30 transition-all duration-500"
                      style={{ width: `${((month.total - month.paid) / maxMonthly) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-pw-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-pw-green" /> {t('paidLegend')}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-pw-blue/30" /> {t('openLegend')}
          </span>
        </div>
      </div>

      {/* Top Vendors — blurred unless unlocked */}
      {topVendors.length > 0 && (
        <div className="relative">
          <div className={statsUnlocked ? '' : 'pointer-events-none select-none blur-[6px] opacity-60'}>
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
            <h3 className="text-[14px] font-bold text-pw-navy">{t('topVendors')}</h3>
          </div>
          <div className="space-y-3">
            {topVendors.map((vendor, i) => (
              <div key={vendor.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-pw-text">
                    {i + 1}. {vendor.name}
                  </span>
                  <span className="text-[12px] font-bold text-pw-navy">{formatCents(vendor.total)}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100">
                  <div
                    className="h-1.5 rounded-full bg-pw-amber transition-all duration-500"
                    style={{ width: `${(vendor.total / maxVendorTotal) * 100}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[10px] text-pw-muted">
                  {vendor.count} {vendor.count === 1 ? t('bill') : t('bills')}
                </p>
              </div>
            ))}
          </div>
        </div>
          </div>
          {!statsUnlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-card bg-pw-surface/95 border border-pw-blue/20 px-4 py-3 text-center shadow-lg">
                <p className="text-[12px] font-semibold text-pw-navy">Nodig een vriend uit</p>
                <p className="text-[10px] text-pw-muted mt-0.5">om je top leveranciers te zien</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
