'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, Camera, Plus, Shield, AlertTriangle } from 'lucide-react';
import { formatCents, type Bill } from '@/lib/bills';
import { calculateWIKCosts } from '@/lib/wik';
import { useRouter } from 'next/navigation';

export default function OverzichtPage() {
  const t = useTranslations('dashboard');
  const router = useRouter();

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

  const today = new Date().toISOString().split('T')[0];
  const threeDaysFromNow = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  const outstanding = bills.filter((b) => b.status !== 'settled');
  const overdue = outstanding.filter((b) => b.due_date < today);
  const upcoming = outstanding.filter((b) => b.due_date >= today && b.due_date <= threeDaysFromNow);
  const settled = bills.filter((b) => b.status === 'settled');

  const outstandingTotal = outstanding.reduce((sum, b) => sum + b.amount, 0);
  const settledTotal = settled.reduce((sum, b) => sum + b.amount, 0);

  const escalated = outstanding.filter((b) => b.escalation_stage !== 'factuur');

  const savedCents = settled
    .filter((b) => b.paid_date && b.due_date && b.paid_date <= b.due_date)
    .reduce((sum, b) => sum + calculateWIKCosts(b.amount), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>

      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-[76px] rounded-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <StatCard label={t('outstanding')} value={formatCents(outstandingTotal)} color="blue" />
          <StatCard label={t('overdue')} value={overdue.length.toString()} color="red" />
          <StatCard label={t('upcoming')} value={upcoming.length.toString()} color="amber" />
          <StatCard label={t('paid')} value={formatCents(settledTotal)} color="green" />
        </div>
      )}

      {/* Mijn schulden card */}
      {!loading && outstanding.length > 0 && (
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-pw-muted">{t('debtCard')}</p>
              <p className="mt-0.5 text-[24px] font-extrabold text-pw-navy">{formatCents(outstandingTotal)}</p>
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
              {savedCents > 0 ? `${formatCents(savedCents)} ${t('saved')}` : t('savedZero')}
            </span>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          onClick={() => router.push('/betalingen?add=true')}
          className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          {t('addBill')}
        </button>
        <button
          onClick={() => router.push('/scan')}
          className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-text"
        >
          <Camera className="h-4 w-4" strokeWidth={1.5} />
          {t('scanBill')}
        </button>
      </div>

      {/* Overdue bills — CLICKABLE, navigate to betalingen */}
      {overdue.length > 0 && (
        <div>
          <h2 className="mb-2 text-[16px] font-bold text-pw-navy">{t('overdueSection')}</h2>
          <div className="space-y-2">
            {overdue.slice(0, 5).map((bill) => (
              <button
                key={bill.id}
                onClick={() => router.push('/betalingen')}
                className="btn-press flex w-full items-center justify-between rounded-card border border-pw-red/20 bg-red-50/50 px-3.5 py-3 text-left transition-colors hover:bg-red-50"
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
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && bills.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <LayoutDashboard className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
          <h2 className="text-[16px] font-semibold text-pw-text">{t('noBillsTitle')}</h2>
          <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">{t('noBillsDescription')}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'blue' | 'red' | 'amber' | 'green' }) {
  const gradients = { blue: 'from-blue-50', red: 'from-red-50', amber: 'from-amber-50', green: 'from-green-50' };
  const accents = { blue: 'before:bg-pw-blue', red: 'before:bg-pw-red', amber: 'before:bg-pw-amber', green: 'before:bg-pw-green' };
  const valueColors = { blue: 'text-pw-blue', red: 'text-pw-red', amber: 'text-pw-amber', green: 'text-pw-green' };

  return (
    <div className={`stat-card ${accents[color]} bg-gradient-to-br ${gradients[color]} to-white px-3.5 py-3`}>
      <p className="text-[11px] font-medium text-pw-muted">{label}</p>
      <p className={`mt-1 text-[24px] font-extrabold ${valueColors[color]}`}>{value}</p>
    </div>
  );
}
