'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useMessages } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Plus, Star, Check, CreditCard, List, CalendarDays, ShieldAlert, Landmark } from 'lucide-react';
import { formatCents, type Bill, type EscalationStage } from '@/lib/bills';
import { detectGovBrand, getGovBrandInfo } from '@/lib/gov-brands';
import AddBillDrawer from './add-bill-drawer';
import BillDetailDrawer from './bill-detail-drawer';
import CalendarView from '@/components/calendar-view';
import PaidToast from '@/components/paid-toast';

type TabFilter = 'outstanding' | 'upcoming' | 'overdue' | 'settled';
type ViewMode = 'list' | 'calendar';

const ESCALATION_COLORS: Record<EscalationStage, string> = {
  factuur: 'bg-pw-blue text-pw-blue',
  herinnering: 'bg-pw-amber text-pw-amber',
  aanmaning: 'bg-pw-orange text-pw-orange',
  incasso: 'bg-pw-red text-pw-red',
  deurwaarder: 'bg-[#991B1B] text-[#991B1B]',
};

const CONFETTI_COLORS = ['#059669', '#2563EB', '#D97706', '#7C3AED', '#EA580C'];

export default function BillList() {
  const t = useTranslations('bills');
  const tEsc = useTranslations('escalation');
  const tCat = useTranslations('addBill');
  const messages = useMessages();

  const catMap = (messages as Record<string, unknown>)?.addBill && typeof (messages as Record<string, unknown>).addBill === 'object'
    ? ((messages as Record<string, Record<string, unknown>>).addBill.categories as Record<string, string>) || {}
    : {};

  const searchParams = useSearchParams();

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('outstanding');
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [justPaidId, setJustPaidId] = useState<string | null>(null);
  const [confettiOrigin, setConfettiOrigin] = useState<{ x: number; y: number } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [paidToast, setPaidToast] = useState<{ vendor: string; amount: number; currency: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setAddDrawerOpen(true);
      window.history.replaceState(null, '', '/betalingen');
    }
  }, [searchParams]);

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

  useEffect(() => { fetchBills(); }, [fetchBills]);

  useEffect(() => {
    if (selectedBill) {
      const updated = bills.find((b) => b.id === selectedBill.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedBill)) {
        setSelectedBill(updated);
      } else if (!updated) {
        setSelectedBill(null);
      }
    }
  }, [bills, selectedBill]);

  const handleBillPaid = useCallback((billId: string) => {
    const paidBill = bills.find((b) => b.id === billId);
    if (paidBill) {
      setPaidToast({ vendor: paidBill.vendor, amount: paidBill.amount, currency: paidBill.currency || 'EUR' });
    }

    setJustPaidId(billId);
    setSelectedBill(null);

    const el = document.querySelector(`[data-bill-id="${billId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setConfettiOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }

    setTimeout(() => {
      setJustPaidId(null);
      setConfettiOrigin(null);
      fetchBills();
    }, 600);
  }, [fetchBills, bills]);

  const handleQuickPay = useCallback(async (bill: Bill) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'settled', paid_date: today }),
      });
      if (res.ok) {
        handleBillPaid(bill.id);
      }
    } catch { /* silent */ }
  }, [handleBillPaid]);

  const today = new Date().toISOString().split('T')[0];
  const threeDaysFromNow = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  const filteredBills = bills.filter((bill) => {
    switch (activeTab) {
      case 'outstanding': return bill.status !== 'settled' && bill.due_date >= today;
      case 'upcoming': return bill.status !== 'settled' && bill.due_date >= today && bill.due_date <= threeDaysFromNow;
      case 'overdue': return bill.status !== 'settled' && bill.due_date < today;
      case 'settled': return bill.status === 'settled';
      default: return true;
    }
  });

  const sortedBills = [...filteredBills].sort((a, b) => {
    // Gov bills (CJIB/Belastingdienst) always sort to top
    const aGov = detectGovBrand(a.vendor);
    const bGov = detectGovBrand(b.vendor);
    if (aGov && !bGov) return -1;
    if (!aGov && bGov) return 1;
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
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-input border border-pw-border bg-pw-surface">
            <button onClick={() => setViewMode('list')}
              className={`flex items-center justify-center rounded-[6px] p-1.5 transition-colors ${viewMode === 'list' ? 'bg-pw-blue text-white' : 'text-pw-muted hover:text-pw-text'}`}
              aria-label="Lijstweergave">
              <List className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button onClick={() => setViewMode('calendar')}
              className={`flex items-center justify-center rounded-[6px] p-1.5 transition-colors ${viewMode === 'calendar' ? 'bg-pw-blue text-white' : 'text-pw-muted hover:text-pw-text'}`}
              aria-label="Kalenderweergave">
              <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
          <button onClick={() => setAddDrawerOpen(true)}
            className="btn-press flex items-center gap-1.5 rounded-button bg-pw-blue px-3 py-2 text-[13px] font-semibold text-white">
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            {t('addBill')}
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <CalendarView bills={bills} onSelectBill={(bill) => setSelectedBill(bill)} />
      ) : (
        <>
          <div className="flex gap-1.5 rounded-input bg-pw-border/50 p-1">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 rounded-[6px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  activeTab === tab.key ? 'bg-pw-surface text-pw-text shadow-sm' : 'text-pw-muted hover:text-pw-text'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-[72px] rounded-card" />)}</div>
          ) : sortedBills.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <CreditCard className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
              <h2 className="text-[16px] font-semibold text-pw-text">{t('noBills')}</h2>
              <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">{t('noBillsHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedBills.map((bill, index) => (
                <BillRow key={bill.id} bill={bill} index={index} tEsc={tEsc} catMap={catMap}
                  isExiting={justPaidId === bill.id} onTap={() => setSelectedBill(bill)}
                  onQuickPay={() => handleQuickPay(bill)} />
              ))}
            </div>
          )}
        </>
      )}

      {confettiOrigin && <ConfettiBurst x={confettiOrigin.x} y={confettiOrigin.y} />}
      {paidToast && <PaidToast vendor={paidToast.vendor} amount={paidToast.amount} currency={paidToast.currency} onDone={() => setPaidToast(null)} />}

      <AddBillDrawer open={addDrawerOpen} onClose={() => setAddDrawerOpen(false)} onBillAdded={fetchBills} />
      <BillDetailDrawer bill={selectedBill} onClose={() => setSelectedBill(null)} onUpdate={fetchBills} onPaid={handleBillPaid} />
    </div>
  );
}

function BillRow({ bill, index, tEsc, catMap, isExiting, onTap, onQuickPay }: {
  bill: Bill; index: number; tEsc: ReturnType<typeof useTranslations>;
  catMap: Record<string, string>; isExiting: boolean; onTap: () => void; onQuickPay: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = bill.status !== 'settled' && bill.due_date < today;
  const isPaid = bill.status === 'settled';
  const fourDaysFromNow = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
  const isUpcoming = !isPaid && !isOverdue && bill.due_date <= fourDaysFromNow;
  const escColor = ESCALATION_COLORS[bill.escalation_stage] || ESCALATION_COLORS.factuur;

  // Government brand detection
  const govBrand = detectGovBrand(bill.vendor);
  const brandInfo = govBrand ? getGovBrandInfo(govBrand) : null;

  const dueDisplay = new Date(bill.due_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

  // Determine row styling
  const baseStyle = isOverdue ? 'border-pw-red/20 bg-red-50/30'
    : isUpcoming ? 'border-pw-amber/20 bg-amber-50/20'
    : brandInfo ? `bg-pw-surface` : 'border-pw-border bg-pw-surface';

  const borderStyle = brandInfo ? { borderColor: `${brandInfo.color}30` } : undefined;

  return (
    <div
      data-bill-id={bill.id}
      className={`bill-row-press relative flex w-full items-center gap-3 rounded-card border px-3.5 py-3 transition-colors overflow-hidden ${
        isExiting ? 'bill-paid-exit' : 'bill-row-enter'
      } ${baseStyle}`}
      style={{
        ...(brandInfo ? { borderColor: `${brandInfo.color}30`, boxShadow: `0 0 12px ${brandInfo.color}10` } : {}),
        ...(!isExiting ? { animationDelay: `${index * 60}ms` } : {}),
      }}
    >
      {/* Brand accent stripe for gov bills */}
      {brandInfo && (
        <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: brandInfo.color }} />
      )}

      {/* Icon area — brand icon or favorite star */}
      <div className="flex-shrink-0" style={brandInfo ? { marginLeft: 4 } : undefined}>
        {brandInfo ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-input" style={{ background: brandInfo.colorLight }}>
            {brandInfo.brand === 'cjib' ? (
              <ShieldAlert className="h-4 w-4" style={{ color: brandInfo.color }} strokeWidth={1.5} />
            ) : (
              <Landmark className="h-4 w-4" style={{ color: brandInfo.color }} strokeWidth={1.5} />
            )}
          </div>
        ) : bill.is_favorite ? (
          <Star className="h-4 w-4 fill-pw-amber text-pw-amber" strokeWidth={1.5} />
        ) : (
          <div className="h-4 w-4" />
        )}
      </div>

      {/* Bill info — tappable to open drawer */}
      <button onClick={onTap} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-semibold text-pw-text">{bill.vendor}</p>
          {brandInfo && (
            <span className="flex-shrink-0 rounded-[3px] px-[5px] py-[1px] text-[8px] font-bold tracking-wider text-white"
              style={{ background: brandInfo.color }}>
              PRIORITEIT
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className={`escalation-dot ${escColor.split(' ')[0]}`} />
            <span className={`text-[11px] font-semibold ${escColor.split(' ')[1]}`}>{tEsc(bill.escalation_stage)}</span>
          </span>
          {brandInfo && (bill as unknown as Record<string, unknown>).bill_subtype ? (
            <span className="text-[11px] font-medium" style={{ color: brandInfo.color }}>
              {(bill as unknown as Record<string, unknown>).bill_subtype as string}
            </span>
          ) : (
            <span className="text-[11px] text-pw-muted">{catMap[bill.category] || bill.category.charAt(0).toUpperCase() + bill.category.slice(1)}</span>
          )}
        </div>
      </button>

      {/* Amount + due date */}
      <button onClick={onTap} className="flex-shrink-0 text-right">
        <p className="text-[15px] font-bold text-pw-text">{formatCents(bill.amount, bill.currency)}</p>
        {isPaid ? (
          <span className="flex items-center justify-end gap-1 text-[11px] font-medium text-pw-green"><Check className="h-3 w-3" strokeWidth={2} />{dueDisplay}</span>
        ) : isOverdue ? (
          <span className="text-[11px] font-medium text-pw-red">{dueDisplay}</span>
        ) : isUpcoming ? (
          <span className="text-[11px] font-medium text-pw-amber">{dueDisplay}</span>
        ) : (
          <span className="text-[11px] text-pw-muted">{dueDisplay}</span>
        )}
      </button>

      {/* Quick pay button */}
      {!isPaid && (
        <button
          onClick={(e) => { e.stopPropagation(); onQuickPay(); }}
          className="btn-press flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-input border border-pw-green/20 bg-green-50/50 text-pw-green transition-colors hover:bg-green-50"
          aria-label="Markeer als betaald"
        >
          <Check className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function ConfettiBurst({ x, y }: { x: number; y: number }) {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    const distance = 20 + Math.random() * 30;
    const dx = Math.cos((angle * Math.PI) / 180) * distance;
    const dy = Math.sin((angle * Math.PI) / 180) * distance - 20;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    return (
      <div key={i} className="confetti-particle"
        style={{ left: x, top: y, backgroundColor: color, '--confetti-x': `${dx}px`, '--confetti-y': `${dy}px`, animationDelay: `${Math.random() * 100}ms` } as React.CSSProperties} />
    );
  });
  return <div className="pointer-events-none fixed inset-0 z-[100]">{particles}</div>;
}
