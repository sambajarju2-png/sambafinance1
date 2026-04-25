'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations, useMessages } from 'next-intl';
import { hapticFeedback, haptic } from '@/lib/capacitor';
import {
  X, Calendar, Tag, FileText, Hash, CreditCard, ExternalLink,
  Check, Star, Trash2, Loader2, Copy, Pencil, ShieldAlert, Landmark, Clock,
  Image as ImageIcon, Shield, TrendingDown,
} from 'lucide-react';
import { formatCents, type Bill, type EscalationStage } from '@/lib/bills';
import { calculateWIKCosts } from '@/lib/wik';
import { detectGovBrand, getGovBrandInfo, detectCjibSubtype, detectBelastingSubtype } from '@/lib/gov-brands';
import dynamic from 'next/dynamic';
import EditBillDrawer from './edit-bill-drawer';
import EscalationInfo from '@/components/escalation-info';
import LawyerReferral from '@/components/lawyer-referral';
import PaymentConfirmationDrawer from '@/components/payment-confirmation-drawer';
import { PaymentPlanSetup } from '@/components/payment-plan-setup';
import { PaymentPlanTracker, PaymentPlanHeaderInfo } from '@/components/payment-plan-tracker';

const DraftLetterDrawer = dynamic(() => import('./draft-letter-drawer'), {
  loading: () => <div className="skeleton h-48 rounded-card" />,
});

type DrawerTab = 'details' | 'escalatie' | 'acties' | 'regeling';

interface PaymentPlanData {
  id: string;
  total_terms: number;
  amount_per_term: number;
  payment_day: number;
  start_date: string;
  status: 'active' | 'completed' | 'cancelled';
  plan_installments: Array<{
    id: string;
    term_number: number;
    due_date: string;
    amount: number;
    status: 'pending' | 'paid' | 'overdue';
    paid_date: string | null;
  }>;
  summary: {
    paid_count: number;
    total_count: number;
    paid_amount: number;
    remaining_amount: number;
  };
}

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  factuur: { bg: 'bg-pw-blue/10', text: 'text-pw-blue', dot: 'bg-pw-blue' },
  herinnering: { bg: 'bg-amber-50', text: 'text-pw-amber', dot: 'bg-pw-amber' },
  aanmaning: { bg: 'bg-orange-50', text: 'text-pw-orange', dot: 'bg-pw-orange' },
  incasso: { bg: 'bg-red-50', text: 'text-pw-red', dot: 'bg-pw-red' },
  deurwaarder: { bg: 'bg-red-100', text: 'text-[#991B1B]', dot: 'bg-[#991B1B]' },
};

interface BillDetailDrawerProps {
  bill: Bill | null;
  onClose: () => void;
  onUpdate: () => void;
  onPaid?: (billId: string) => void;
}

export default function BillDetailDrawer({ bill, onClose, onUpdate, onPaid }: BillDetailDrawerProps) {
  const t = useTranslations('billDetail');
  const tEsc = useTranslations('escalation');
  const tCat = useTranslations('addBill');
  const messages = useMessages();
  const catMap = (messages as Record<string, unknown>)?.addBill && typeof (messages as Record<string, unknown>).addBill === 'object'
    ? ((messages as Record<string, Record<string, unknown>>).addBill.categories as Record<string, string>) || {}
    : {};

  const [activeTab, setActiveTab] = useState<DrawerTab>('details');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [draftLetterOpen, setDraftLetterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [gemeente, setGemeente] = useState<string | null>(null);
  // Confirmation drawer state
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(bill?.confirmation_image_url || null);
  // Payment plan state
  const [showPlanSetup, setShowPlanSetup] = useState(false);
  const [plan, setPlan] = useState<PaymentPlanData | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const hasPaymentPlan = !!bill?.has_payment_plan;

  useEffect(() => {
    async function loadGemeente() {
      try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) {
          const { profile } = await res.json();
          setGemeente(profile?.gemeente || null);
        }
      } catch { /* silent */ }
    }
    loadGemeente();
  }, []);

  // Update confirmation URL when bill changes
  useEffect(() => {
    setConfirmationUrl(bill?.confirmation_image_url || null);
  }, [bill?.confirmation_image_url]);

  // Fetch payment plan data
  const fetchPlan = useCallback(async () => {
    if (!bill) return;
    setPlanLoading(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/payment-plan`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
      } else {
        setPlan(null);
      }
    } catch {
      setPlan(null);
    } finally {
      setPlanLoading(false);
    }
  }, [bill]);

  // Load plan when drawer opens and bill has a plan
  useEffect(() => {
    if (hasPaymentPlan && bill) {
      fetchPlan();
    } else {
      setPlan(null);
    }
  }, [hasPaymentPlan, bill, fetchPlan]);

  if (!bill) return null;

  const isPaid = bill.status === 'settled';
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !isPaid && bill.due_date < today;
  const stage = STAGE_COLORS[bill.escalation_stage] || STAGE_COLORS.factuur;

  // Government brand detection
  const govBrand = detectGovBrand(bill.vendor);
  const brandInfo = govBrand ? getGovBrandInfo(govBrand) : null;
  const billSubtype = govBrand === 'cjib'
    ? detectCjibSubtype(bill.vendor, bill.notes || '')
    : govBrand === 'belastingdienst'
      ? detectBelastingSubtype(bill.vendor, bill.notes || '')
      : null;

  function getCategoryLabel(cat: string): string {
    return catMap[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  async function handleMarkAsPaid() {
    setActionLoading('paid');
    try {
      const res = await fetch(`/api/bills/${bill!.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'settled', paid_date: today }),
      });
      if (res.ok) {
        hapticFeedback('heavy');
        onUpdate();
        setActionLoading(null);
        setConfirmationOpen(true);
      }
    } catch { /* silent */ } finally { setActionLoading(null); }
  }

  async function patchBill(body: Record<string, unknown>, loadingKey: string) {
    setActionLoading(loadingKey);
    try {
      const res = await fetch(`/api/bills/${bill!.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onUpdate();
        if (loadingKey === 'delete') onClose();
      }
    } catch { /* silent */ } finally { setActionLoading(null); }
  }

  async function deleteBill() {
    if (!confirm(t('deleteConfirm'))) return;
    setActionLoading('delete');
    try {
      const res = await fetch(`/api/bills/${bill!.id}`, { method: 'DELETE' });
      if (res.ok) { onUpdate(); onClose(); }
    } catch { /* silent */ } finally { setActionLoading(null); }
  }

  // Build tabs — include Regeling only when bill has a payment plan
  const tabs: { key: DrawerTab; label: string }[] = [
    { key: 'details', label: t('tabDetails') },
    { key: 'escalatie', label: t('tabEscalation') },
    { key: 'acties', label: t('tabActions') },
    ...(hasPaymentPlan ? [{ key: 'regeling' as DrawerTab, label: 'Regeling' }] : []),
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 1 }}
        onAnimationStart={() => haptic('tap')}
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]"
      >
        <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-pw-border" /></div>

        {/* ── Branded Gov Header (CJIB / Belastingdienst) ── */}
        {brandInfo ? (
          <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${brandInfo.color}, ${brandInfo.color}DD)` }}>
            <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />

            <button onClick={onClose} className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>

            <div className="px-4 pb-4 pt-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px]" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  {brandInfo.brand === 'cjib' ? (
                    <ShieldAlert className="h-5 w-5 text-white" strokeWidth={1.5} />
                  ) : (
                    <Landmark className="h-5 w-5 text-white" strokeWidth={1.5} />
                  )}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white">{brandInfo.shortName}</p>
                  {brandInfo.brand === 'cjib' && (
                    <p className="text-[10px] text-white/60">Centraal Justitieel Incassobureau</p>
                  )}
                </div>
                <div className="ml-auto rounded-[3px] px-[6px] py-[2px]" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
                  <span className="text-[8px] font-bold tracking-wider text-white">PRIORITEIT</span>
                </div>
              </div>

              <p className="text-[28px] font-extrabold tracking-tight text-white">
                {formatCents(bill.amount, bill.currency)}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-white/90">{bill.vendor}</p>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {billSubtype && (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}>
                    {billSubtype}
                  </span>
                )}
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}>
                  {tEsc(bill.escalation_stage as EscalationStage)}
                </span>
                {isPaid && <span className="flex items-center gap-1 text-[10px] font-semibold text-white/80"><Check className="h-3 w-3" strokeWidth={2} /> Betaald</span>}
                {isOverdue && <span className="text-[10px] font-semibold text-red-200">Achterstallig</span>}
              </div>

              {/* Payment plan progress in gov header */}
              {hasPaymentPlan && plan && (
                <div className="mt-3 rounded-[8px] px-3 py-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-white/90">Betalingsregeling</span>
                    <span className="text-[11px] font-bold text-white">{plan.summary.paid_count}/{plan.summary.total_count}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <div className="h-full rounded-full bg-white/80 transition-all duration-500" style={{ width: `${plan.summary.total_count > 0 ? (plan.summary.paid_count / plan.summary.total_count) * 100 : 0}%` }} />
                  </div>
                </div>
              )}

              {!isPaid && !hasPaymentPlan && (
                <div className="mt-3 flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <Clock className="h-3.5 w-3.5 text-white/70 flex-shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="text-[11px] font-semibold text-white/90">{brandInfo.deadlineNote}</p>
                    <p className="text-[10px] text-white/50">{brandInfo.escalationNote}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Standard Header ── */
          <div className="relative px-4 pb-3 pt-3">
            <button onClick={onClose} className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <p className="text-[28px] font-extrabold tracking-tight text-pw-text">{formatCents(bill.amount, bill.currency)}</p>
            <p className="mt-0.5 text-[16px] font-semibold text-pw-navy">{bill.vendor}</p>

            <div className="mt-2 flex items-center gap-2">
              <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${stage.bg}`}>
                <div className={`escalation-dot ${stage.dot}`} />
                <span className={`text-[11px] font-semibold ${stage.text}`}>{tEsc(bill.escalation_stage as EscalationStage)}</span>
              </div>
              {isPaid && <span className="flex items-center gap-1 text-[11px] font-semibold text-pw-green"><Check className="h-3 w-3" strokeWidth={2} /> {t('paid')}</span>}
              {isOverdue && <span className="text-[11px] font-semibold text-pw-red">{t('overdue')}</span>}
            </div>

            {/* Payment plan progress in standard header */}
            {hasPaymentPlan && plan && (
              <PaymentPlanHeaderInfo
                paidAmount={plan.summary.paid_amount}
                totalAmount={bill.amount}
                paidCount={plan.summary.paid_count}
                totalCount={plan.summary.total_count}
              />
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 pt-3 scrollbar-none">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                activeTab === tab.key ? 'bg-pw-navy text-white' : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-4 pb-8 pt-4">
          {activeTab === 'details' && (
            <div className="space-y-3">
              <DetailRow icon={Calendar} label={t('dueDate')} value={new Date(bill.due_date + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
              <DetailRow icon={Calendar} label={t('receivedDate')} value={new Date(bill.received_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <DetailRow icon={Tag} label={t('category')} value={getCategoryLabel(bill.category)} />
              <DetailRow icon={FileText} label={t('source')} value={t(`source_${bill.source}`)} />
              {billSubtype && <DetailRow icon={brandInfo?.brand === 'cjib' ? ShieldAlert : Landmark} label="Type" value={billSubtype} />}
              {bill.reference && <DetailRow icon={Hash} label={t('reference')} value={bill.reference} copyable />}
              {bill.iban && <DetailRow icon={CreditCard} label="IBAN" value={bill.iban} copyable />}
              {bill.payment_url && (
                <a href={bill.payment_url} target="_blank" rel="noopener noreferrer"
                  className="btn-press flex items-center gap-2 rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 text-[13px] font-semibold text-pw-blue">
                  <ExternalLink className="h-4 w-4" strokeWidth={1.5} /> {t('openPaymentLink')}
                </a>
              )}
              {bill.paid_date && (
                <DetailRow icon={Check} label={t('paidOn')} value={new Date(bill.paid_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })} />
              )}

              {/* Confirmation image — show if paid */}
              {isPaid && (
                <button onClick={() => setConfirmationOpen(true)}
                  className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 text-left">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-input ${confirmationUrl ? 'bg-pw-green/10' : 'bg-pw-bg'}`}>
                    {confirmationUrl ? (
                      <Shield className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-pw-text">
                      {confirmationUrl ? 'Betalingsbewijs opgeslagen' : 'Betalingsbewijs toevoegen'}
                    </p>
                    <p className="text-[11px] text-pw-muted">
                      {confirmationUrl ? 'Tik om te bekijken of te vervangen' : 'Bewaar je betaalbewijs veilig'}
                    </p>
                  </div>
                  {confirmationUrl && (
                    <div className="flex items-center gap-1 rounded-full bg-pw-green/10 px-2 py-0.5">
                      <Check className="h-3 w-3 text-pw-green" strokeWidth={2} />
                      <span className="text-[9px] font-bold text-pw-green">Bewaard</span>
                    </div>
                  )}
                </button>
              )}
            </div>
          )}

          {activeTab === 'escalatie' && (
            <div className="space-y-4">
              <div className={`flex items-center gap-3 rounded-card p-4 ${stage.bg}`}>
                <div className={`h-4 w-4 rounded-full ${stage.dot}`} />
                <div>
                  <p className={`text-[16px] font-bold ${stage.text}`}>{tEsc(bill.escalation_stage as EscalationStage)}</p>
                  <p className="text-[11px] text-pw-muted">{t('currentStage')}</p>
                </div>
              </div>

              {bill.escalation_stage !== 'factuur' && (
                <div className="rounded-card border border-pw-red/20 bg-red-50 p-3">
                  <p className="text-[13px] font-semibold text-pw-red">
                    +{formatCents(calculateWIKCosts(bill.amount), 'EUR')} {t('extraCosts')}
                  </p>
                </div>
              )}

              {brandInfo && !isPaid && (
                <div className="rounded-card p-4" style={{ background: brandInfo.colorLight, border: `1px solid ${brandInfo.color}20` }}>
                  <div className="flex items-center gap-2 mb-2">
                    {brandInfo.brand === 'cjib' ? (
                      <ShieldAlert className="h-4 w-4 flex-shrink-0" style={{ color: brandInfo.color }} strokeWidth={1.5} />
                    ) : (
                      <Landmark className="h-4 w-4 flex-shrink-0" style={{ color: brandInfo.color }} strokeWidth={1.5} />
                    )}
                    <p className="text-[13px] font-bold" style={{ color: brandInfo.color }}>{brandInfo.shortName}</p>
                  </div>
                  <p className="text-[12px] font-semibold" style={{ color: brandInfo.color }}>{brandInfo.deadlineNote}</p>
                  <p className="text-[11px] text-pw-muted mt-1">{brandInfo.escalationNote}</p>
                </div>
              )}

              <LawyerReferral stage={bill.escalation_stage} gemeente={gemeente} />
              <EscalationInfo stage={bill.escalation_stage} amountCents={bill.amount} dueDate={bill.due_date} />
            </div>
          )}

          {activeTab === 'acties' && (
            <div className="space-y-3">
              <ActionButton icon={Pencil} label={t('editBill')} desc={t('editBillDesc')} color="text-pw-blue"
                loading={false} onClick={() => setEditOpen(true)} />
              {!isPaid && !hasPaymentPlan && (
                <ActionButton icon={Check} label={t('markAsPaid')} desc={t('markAsPaidDesc')} color="text-pw-green"
                  loading={actionLoading === 'paid'} onClick={handleMarkAsPaid} />
              )}
              {isPaid && (
                <ActionButton icon={ImageIcon} 
                  label={confirmationUrl ? 'Betalingsbewijs bekijken' : 'Betalingsbewijs toevoegen'} 
                  desc={confirmationUrl ? 'Bekijk, vervang of verwijder je bewijs' : 'Bewaar een screenshot of foto als bewijs'}
                  color="text-pw-green"
                  loading={false} onClick={() => setConfirmationOpen(true)} />
              )}

              {/* Betalingsregeling button — only if no plan yet and not settled */}
              {!isPaid && !hasPaymentPlan && (
                <ActionButton icon={TrendingDown} label="Betalingsregeling getroffen" desc="Betaal in termijnen en houd je voortgang bij" color="text-pw-blue"
                  loading={false} onClick={() => setShowPlanSetup(true)} />
              )}

              {/* Show link to Regeling tab if plan exists */}
              {hasPaymentPlan && (
                <ActionButton icon={TrendingDown} label="Bekijk betalingsregeling" desc={plan ? `${plan.summary.paid_count}/${plan.summary.total_count} termijnen betaald` : 'Bekijk je voortgang'} color="text-pw-blue"
                  loading={false} onClick={() => setActiveTab('regeling')} />
              )}

              {!isPaid && (
                <ActionButton icon={FileText} label={t('draftLetter')} desc={t('draftLetterDesc')} color="text-pw-purple"
                  loading={false} onClick={() => setDraftLetterOpen(true)} />
              )}
              <ActionButton icon={Star} label={bill.is_favorite ? t('removeFavorite') : t('addFavorite')} desc={t('favoriteDesc')} color="text-pw-amber"
                loading={actionLoading === 'fav'} onClick={() => patchBill({ is_favorite: !bill.is_favorite }, 'fav')} />
              <ActionButton icon={Trash2} label={t('deleteBill')} desc={t('deleteBillDesc')} color="text-pw-red"
                loading={actionLoading === 'delete'} onClick={deleteBill} />
            </div>
          )}

          {activeTab === 'regeling' && (
            <div>
              {planLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-20 bg-pw-border rounded-card" />
                  <div className="h-14 bg-pw-border rounded-card" />
                  <div className="h-14 bg-pw-border rounded-card" />
                  <div className="h-14 bg-pw-border rounded-card" />
                </div>
              ) : plan ? (
                <PaymentPlanTracker
                  billId={bill.id}
                  plan={plan}
                  onUpdate={() => { fetchPlan(); onUpdate(); }}
                  onCancel={() => { setPlan(null); onUpdate(); }}
                  onInstallmentPaid={() => setConfirmationOpen(true)}
                />
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <TrendingDown className="mb-3 h-10 w-10 text-pw-muted/40" strokeWidth={1.5} />
                  <p className="text-[13px] text-pw-muted">Geen betalingsregeling gevonden</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <DraftLetterDrawer bill={bill} open={draftLetterOpen} onClose={() => setDraftLetterOpen(false)} />
      <EditBillDrawer bill={bill} open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => { onUpdate(); setEditOpen(false); }} />

      {/* Payment Confirmation Drawer */}
      <PaymentConfirmationDrawer
        open={confirmationOpen}
        billId={bill.id}
        billVendor={bill.vendor}
        billAmount={formatCents(bill.amount, bill.currency)}
        existingImageUrl={confirmationUrl}
        onClose={() => setConfirmationOpen(false)}
        onUploaded={(url) => { setConfirmationUrl(url); onUpdate(); }}
        onRemoved={() => { setConfirmationUrl(null); onUpdate(); }}
      />

      {/* Payment Plan Setup Drawer */}
      {showPlanSetup && (
        <PaymentPlanSetup
          billId={bill.id}
          billAmount={bill.amount}
          vendorName={bill.vendor}
          onClose={() => setShowPlanSetup(false)}
          onCreated={() => {
            setShowPlanSetup(false);
            onUpdate();
            // Refresh plan and switch to Regeling tab
            setTimeout(() => {
              fetchPlan();
              setActiveTab('regeling');
            }, 300);
          }}
        />
      )}
    </>
  );
}

function DetailRow({ icon: Icon, label, value, copyable = false }: { icon: React.ElementType; label: string; value: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-3.5 py-3">
      <Icon className="h-4 w-4 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-pw-muted">{label}</p>
        <p className="truncate text-[13px] font-semibold text-pw-text">{value}</p>
      </div>
      {copyable && (
        <button onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="flex-shrink-0 text-pw-muted hover:text-pw-blue">
          {copied ? <Check className="h-4 w-4 text-pw-green" strokeWidth={1.5} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
        </button>
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, desc, color, loading, onClick }: {
  icon: React.ElementType; label: string; desc: string; color: string; loading: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 text-left transition-colors hover:bg-pw-bg disabled:opacity-50">
      <div className={`flex h-9 w-9 items-center justify-center rounded-input bg-pw-bg ${color}`}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Icon className="h-4 w-4" strokeWidth={1.5} />}
      </div>
      <div><p className="text-[13px] font-semibold text-pw-text">{label}</p><p className="text-[11px] text-pw-muted">{desc}</p></div>
    </button>
  );
}
