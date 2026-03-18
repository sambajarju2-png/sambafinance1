'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  X, Calendar, Tag, FileText, Hash, CreditCard, ExternalLink,
  Check, Star, Trash2, Loader2, Copy, Shield, Pencil,
} from 'lucide-react';
import { formatCents, type Bill, type EscalationStage } from '@/lib/bills';
import { calculateWIKCosts } from '@/lib/wik';
import DraftLetterDrawer from './draft-letter-drawer';
import EditBillDrawer from './edit-bill-drawer';
import EscalationInfo from '@/components/escalation-info';

type DrawerTab = 'details' | 'acties' | 'notitie';

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
}

export default function BillDetailDrawer({ bill, onClose, onUpdate }: BillDetailDrawerProps) {
  const t = useTranslations('billDetail');
  const tEsc = useTranslations('escalation');

  const [activeTab, setActiveTab] = useState<DrawerTab>('details');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notes, setNotes] = useState(bill?.notes || '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [draftLetterOpen, setDraftLetterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (!bill) return null;

  const isPaid = bill.status === 'settled';
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !isPaid && bill.due_date < today;
  const stage = STAGE_COLORS[bill.escalation_stage] || STAGE_COLORS.factuur;

  async function patchBill(body: Record<string, unknown>, loadingKey: string) {
    setActionLoading(loadingKey);
    try {
      const res = await fetch(`/api/bills/${bill!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onUpdate();
        if (loadingKey === 'paid' || loadingKey === 'delete') onClose();
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

  async function saveNotes() {
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/bills/${bill!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000); onUpdate(); }
    } catch { /* silent */ } finally { setNotesSaving(false); }
  }

  const tabs: { key: DrawerTab; label: string }[] = [
    { key: 'details', label: t('tabDetails') },
    { key: 'acties', label: t('tabActions') },
    { key: 'notitie', label: t('tabNotes') },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      <div className="drawer-enter fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-pw-border" />
        </div>

        {/* Header */}
        <div className="relative px-4 pb-3 pt-3">
          <button onClick={onClose} className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <p className="text-[28px] font-extrabold tracking-tight text-pw-text">
            {formatCents(bill.amount, bill.currency)}
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-pw-navy">{bill.vendor}</p>

          {/* Stage badge */}
          <div className="mt-2 flex items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${stage.bg}`}>
              <div className={`escalation-dot ${stage.dot}`} />
              <span className={`text-[11px] font-semibold ${stage.text}`}>
                {tEsc(bill.escalation_stage as EscalationStage)}
              </span>
            </div>

            {isPaid && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-pw-green">
                <Check className="h-3 w-3" strokeWidth={2} /> {t('paid')}
              </span>
            )}

            {isOverdue && (
              <span className="text-[11px] font-semibold text-pw-red">{t('overdue')}</span>
            )}
          </div>

          {/* WIK costs */}
          {bill.escalation_stage !== 'factuur' && (
            <p className="mt-1.5 text-[11px] text-pw-muted">
              +{formatCents(calculateWIKCosts(bill.amount), 'EUR')} {t('extraCosts')}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                activeTab === tab.key ? 'bg-pw-navy text-white' : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4 pb-8 pt-4">
          {activeTab === 'details' && (
            <div className="space-y-3">
              <DetailRow icon={Calendar} label={t('dueDate')} value={new Date(bill.due_date + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
              <DetailRow icon={Calendar} label={t('receivedDate')} value={new Date(bill.received_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <DetailRow icon={Tag} label={t('category')} value={bill.category} />
              <DetailRow icon={FileText} label={t('source')} value={t(`source_${bill.source}`)} />
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

              <EscalationInfo stage={bill.escalation_stage} amountCents={bill.amount} dueDate={bill.due_date} />
            </div>
          )}

          {activeTab === 'acties' && (
            <div className="space-y-3">
              {/* Edit button — always visible */}
              <ActionButton icon={Pencil} label={t('editBill')} desc={t('editBillDesc')} color="text-pw-blue"
                loading={false} onClick={() => setEditOpen(true)} />

              {/* Mark as paid */}
              {!isPaid && (
                <ActionButton icon={Check} label={t('markAsPaid')} desc={t('markAsPaidDesc')} color="text-pw-green"
                  loading={actionLoading === 'paid'} onClick={() => patchBill({ status: 'settled', paid_date: today }, 'paid')} />
              )}

              {/* Draft letter — only for unpaid bills */}
              {!isPaid && (
                <ActionButton icon={FileText} label="Schrijf concept" desc="Genereer een brief of bezwaar" color="text-pw-purple"
                  loading={false} onClick={() => setDraftLetterOpen(true)} />
              )}

              {/* Favorite toggle */}
              <ActionButton
                icon={Star}
                label={bill.is_favorite ? t('removeFavorite') : t('addFavorite')}
                desc={t('favoriteDesc')}
                color="text-pw-amber"
                loading={actionLoading === 'fav'}
                onClick={() => patchBill({ is_favorite: !bill.is_favorite }, 'fav')}
              />

              {/* Delete */}
              <ActionButton icon={Trash2} label={t('deleteBill')} desc={t('deleteBillDesc')} color="text-pw-red"
                loading={actionLoading === 'delete'} onClick={deleteBill} />
            </div>
          )}

          {activeTab === 'notitie' && (
            <div className="space-y-3">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={t('notesPlaceholder')}
                className="w-full rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 text-[13px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" />
              <button onClick={saveNotes} disabled={notesSaving}
                className="btn-press flex items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
                {notesSaving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> :
                 notesSaved ? <Check className="h-4 w-4" strokeWidth={1.5} /> : null}
                {notesSaved ? t('notesSaved') : t('saveNotes')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Draft letter drawer */}
      <DraftLetterDrawer bill={bill} open={draftLetterOpen} onClose={() => setDraftLetterOpen(false)} />

      {/* Edit bill drawer */}
      <EditBillDrawer bill={bill} open={editOpen} onClose={() => setEditOpen(false)}
        onSaved={() => { onUpdate(); setEditOpen(false); }} />
    </>
  );
}

function DetailRow({ icon: Icon, label, value, copyable = false }: {
  icon: React.ElementType; label: string; value: string; copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-3.5 py-3">
      <Icon className="h-4 w-4 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-pw-muted">{label}</p>
        <p className="truncate text-[13px] font-semibold text-pw-text">{value}</p>
      </div>
      {copyable && (
        <button onClick={handleCopy} className="flex-shrink-0 text-pw-muted hover:text-pw-blue">
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
      <div>
        <p className="text-[13px] font-semibold text-pw-text">{label}</p>
        <p className="text-[11px] text-pw-muted">{desc}</p>
      </div>
    </button>
  );
}
