'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, Camera, Mail, Plus } from 'lucide-react';
import { formatCents, type Bill } from '@/lib/bills';
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

  // Calculate stats
  const outstanding = bills.filter((b) => b.status !== 'settled');
  const overdue = outstanding.filter((b) => b.due_date < today);
  const upcoming = outstanding.filter(
    (b) => b.due_date >= today && b.due_date <= threeDaysFromNow
  );
  const settled = bills.filter((b) => b.status === 'settled');

  const outstandingTotal = outstanding.reduce((sum, b) => sum + b.amount, 0);
  const settledTotal = settled.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>

      {/* Stat cards (2x2) */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-[76px] rounded-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label={t('outstanding')}
            value={formatCents(outstandingTotal)}
            color="blue"
          />
          <StatCard
            label={t('overdue')}
            value={overdue.length.toString()}
            color="red"
          />
          <StatCard
            label={t('upcoming')}
            value={upcoming.length.toString()}
            color="amber"
          />
          <StatCard
            label={t('paid')}
            value={formatCents(settledTotal)}
            color="green"
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          onClick={() => router.push('/betalingen')}
          className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          {t('addBill')}
        </button>
        <button className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-text">
          <Camera className="h-4 w-4" strokeWidth={1.5} />
          {t('scanBill')}
        </button>
      </div>

      {/* Recent overdue bills */}
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
                <p className="text-[15px] font-bold text-pw-red">
                  {formatCents(bill.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'blue' | 'red' | 'amber' | 'green';
}) {
  const gradients = {
    blue: 'bg-gradient-to-br from-blue-50 to-white',
    red: 'bg-gradient-to-br from-red-50 to-white',
    amber: 'bg-gradient-to-br from-amber-50 to-white',
    green: 'bg-gradient-to-br from-green-50 to-white',
  };

  const accentColors = {
    blue: 'before:bg-pw-blue',
    red: 'before:bg-pw-red',
    amber: 'before:bg-pw-amber',
    green: 'before:bg-pw-green',
  };

  const valueColors = {
    blue: 'text-pw-blue',
    red: 'text-pw-red',
    amber: 'text-pw-amber',
    green: 'text-pw-green',
  };

  return (
    <div className={`stat-card ${accentColors[color]} ${gradients[color]} px-3.5 py-3`}>
      <p className="text-[11px] font-medium text-pw-muted">{label}</p>
      <p className={`mt-1 text-[24px] font-extrabold ${valueColors[color]}`}>{value}</p>
    </div>
  );
}
