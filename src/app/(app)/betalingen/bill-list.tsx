'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Plus, Star, Check, CreditCard } from 'lucide-react';
import { formatCents, type Bill, type EscalationStage } from '@/lib/bills';
import AddBillDrawer from './add-bill-drawer';
import BillDetailDrawer from './bill-detail-drawer';

type TabFilter = 'outstanding' | 'upcoming' | 'overdue' | 'settled';

const ESCALATION_COLORS: Record<EscalationStage, string> = {
  factuur: 'bg-pw-blue text-pw-blue',
  herinnering: 'bg-pw-amber text-pw-amber',
  aanmaning: 'bg-pw-orange text-pw-orange',
  incasso: 'bg-pw-red text-pw-red',
  deurwaarder: 'bg-[#991B1B] text-[#991B1B]',
};

export default function BillList() {
  const t = useTranslations('bills');
  const tEsc = useTranslations('escalation');
  const searchParams = useSearchParams();

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('outstanding');
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Auto-open add drawer when navigated with ?add=true
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setAddDrawerOpen(true);
      window.history.replaceState(null, '', '/betalingen');
    }
  }, [searchParams]);

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('outstanding');
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const fetchBills = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // When bills refresh, update the selected bill if it's open
  useEffect(() => {
    if (selectedBill) {
      const updated = bills.find((b) => b.id === selectedBill.id);
      if (updated) {
        setSelectedBill(updated);
      } else {
        setSelectedBill(null);
      }
    }
  }, [bills, selectedBill?.id]);

  const today = new Date().toISOString().split('T')[0];
  const threeDaysFromNow = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  const filteredBills = bills.filter((bill) => {
    switch (activeTab) {
      case 'outstanding':
        return bill.status !== 'settled' && bill.due_date >= today;
      case 'upcoming':
        return bill.status !== 'settled' && bill.due_date >= today && bill.due_date <= threeDaysFromNow;
      case 'overdue':
        return bill.status !== 'settled' && bill.due_date < today;
      case 'settled':
        return bill.status === 'settled';
      default:
        return true;
    }
  });

  const sortedBills = [...filteredBills].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
    return a.due_date.localeCompare(b.due_date);
  });

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'outstanding', label: t('outstanding') },
    { key: 'upcoming', label: t('upcoming') },
    { key: 'overdue', label: t('overdue') },
    { key: 'settled', label: t('paid') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-heading text-pw-navy">{t('pageTitle')}</h1>
        <button
          onClick={() => setAddDrawerOpen(true)}
          className="btn-press flex items-center gap-1.5 rounded-button bg-pw-blue px-3 py-2 text-[13px] font-semibold text-white"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          {t('addBill')}
        </button>
      </div>

      {/* Tab pills */}
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

      {/* Bill list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-[72px] rounded-card" />
          ))}
        </div>
      ) : sortedBills.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <CreditCard className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
          <h2 className="text-[16px] font-semibold text-pw-text">{t('noBills')}</h2>
          <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">
            {t('noBillsHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedBills.map((bill) => (
            <BillRow
              key={bill.id}
              bill={bill}
              tEsc={tEsc}
              onTap={() => setSelectedBill(bill)}
            />
          ))}
        </div>
      )}

      {/* Add Bill Drawer */}
      <AddBillDrawer
        open={addDrawerOpen}
        onClose={() => setAddDrawerOpen(false)}
        onBillAdded={fetchBills}
      />

      {/* Bill Detail Drawer */}
      <BillDetailDrawer
        bill={selectedBill}
        onClose={() => setSelectedBill(null)}
        onUpdate={fetchBills}
      />
    </div>
  );
}

function BillRow({
  bill,
  tEsc,
  onTap,
}: {
  bill: Bill;
  tEsc: ReturnType<typeof useTranslations>;
  onTap: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = bill.status !== 'settled' && bill.due_date < today;
  const isPaid = bill.status === 'settled';
  const fourDaysFromNow = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
  const isUpcoming = !isPaid && !isOverdue && bill.due_date <= fourDaysFromNow;
  const escColor = ESCALATION_COLORS[bill.escalation_stage] || ESCALATION_COLORS.factuur;

  const dueDisplay = new Date(bill.due_date + 'T00:00:00').toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <button
      onClick={onTap}
      className={`btn-press flex w-full items-center gap-3 rounded-card border px-3.5 py-3 text-left transition-colors hover:bg-gray-50/50 ${
        isOverdue ? 'border-pw-red/20 bg-red-50/30' : isUpcoming ? 'border-pw-amber/20 bg-amber-50/20' : 'border-pw-border bg-pw-surface'
      }`}
    >
      {/* Favorite indicator */}
      <div className="flex-shrink-0">
        {bill.is_favorite ? (
          <Star className="h-4 w-4 fill-pw-amber text-pw-amber" strokeWidth={1.5} />
        ) : (
          <div className="h-4 w-4" />
        )}
      </div>

      {/* Bill info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-pw-text">{bill.vendor}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className={`escalation-dot ${escColor.split(' ')[0]}`} />
            <span className={`text-[11px] font-semibold ${escColor.split(' ')[1]}`}>
              {tEsc(bill.escalation_stage)}
            </span>
          </span>
          <span className="text-[11px] text-pw-muted">{bill.category}</span>
        </div>
      </div>

      {/* Amount + due date */}
      <div className="flex-shrink-0 text-right">
        <p className="text-[15px] font-bold text-pw-text">
          {formatCents(bill.amount, bill.currency)}
        </p>
        {isPaid ? (
          <span className="flex items-center justify-end gap-1 text-[11px] font-medium text-pw-green">
            <Check className="h-3 w-3" strokeWidth={2} />
            {dueDisplay}
          </span>
        ) : isOverdue ? (
          <span className="text-[11px] font-medium text-pw-red">{dueDisplay}</span>
        ) : isUpcoming ? (
          <span className="text-[11px] font-medium text-pw-amber">{dueDisplay}</span>
        ) : (
          <span className="text-[11px] text-pw-muted">{dueDisplay}</span>
        )}
      </div>
    </button>
  );
}
