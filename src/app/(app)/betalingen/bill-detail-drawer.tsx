'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  Star,
  Check,
  Trash2,
  Calendar,
  Tag,
  Hash,
  CreditCard,
  FileText,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { formatCents, type Bill, type EscalationStage } from '@/lib/bills';
import DraftLetterDrawer from './draft-letter-drawer';
import EscalationInfo from '@/components/escalation-info';

type DrawerTab = 'details' | 'escalatie' | 'acties' | 'notitie';

const STAGE_COLORS: Record<EscalationStage, { dot: string; text: string; bg: string }> = {
  factuur: { dot: 'bg-pw-blue', text: 'text-pw-blue', bg: 'bg-blue-50' },
  herinnering: { dot: 'bg-pw-amber', text: 'text-pw-amber', bg: 'bg-amber-50' },
  aanmaning: { dot: 'bg-pw-orange', text: 'text-pw-orange', bg: 'bg-orange-50' },
  incasso: { dot: 'bg-pw-red', text: 'text-pw-red', bg: 'bg-red-50' },
  deurwaarder: { dot: 'bg-[#991B1B]', text: 'text-[#991B1B]', bg: 'bg-red-100' },
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
        if (loadingKey === 'paid' || loadingKey === 'delete') {
          onClose();
        }
      }
    } catch {
      // silent fail
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteBill() {
    if (!confirm(t('deleteConfirm'))) return;
    setActionLoading('delete');
    try {
      const res = await fetch(`/api/bills/${bill!.id}`, { method: 'DELETE' });
      if (res.ok) {
        onUpdate();
        onClose();
      }
    } catch {
      // silent fail
    } finally {
      setActionLoading(null);
    }
  }

  async function saveNotes() {
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/bills/${bill!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
        onUpdate();
      }
    } catch {
      // silent fail
    } finally {
      setNotesSaving(false);
    }
  }

  const tabs: { key: DrawerTab; label: string }[] = [
    { key: 'details', label: t('tabDetails') },
    { key: 'escalatie', label: t('tabEscalation') },
    { key: 'acties', label: t('tabActions') },
    { key: 'notitie', label: t('tabNotes') },
  ];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="drawer-enter fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        {/* Handle bar */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-pw-border" />
        </div>

        {/* Header: Amount-first */}
        <div className="relative px-4 pb-3 pt-3">
          <button
            onClick={onClose}
            className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <p className="text-[28px] font-extrabold tracking-tight text-pw-text">
            {formatCents(bill.amount, bill.currency)}
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-pw-text">{bill.vendor}</p>

          <div className="mt-2 flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 ${stage.bg}`}>
              <span className={`escalation-dot ${stage.dot}`} />
              <span className={`text-[11px] font-semibold ${stage.text}`}>
                {tEsc(bill.escalation_stage)}
              </span>
            </span>
            <span className="text-[11px] text-pw-muted">{bill.category}</span>
            {isPaid && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-pw-green">
                <Check className="h-3 w-3" strokeWidth={2} />
                {t('paid')}
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-pw-red">
                <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                {t('overdue')}
              </span>
            )}
          </div>

          {bill.estimated_extra_costs > 0 && (
            <p className="mt-2 text-[12px] font-semibold text-pw-red">
              + {formatCents(bill.estimated_extra_costs)} {t('extraCosts')}
            </p>
          )}
        </div>

        {/* Segment tabs */}
        <div className="mx-4 flex gap-1 rounded-input bg-pw-border/50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-[6px] py-1.5 text-[12px] font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-pw-surface text-pw-text shadow-sm'
                  : 'text-pw-muted hover:text-pw-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4 pb-8 pt-4">
          {activeTab === 'details' && <DetailsTab bill={bill} t={t} />}
          {activeTab === 'escalatie' && (
            <EscalationInfo
              stage={bill.escalation_stage}
              amountCents={bill.amount}
              language="nl"
            />
          )}
          {activeTab === 'acties' && (
            <ActionsTab
              bill={bill}
              t={t}
              isPaid={isPaid}
              actionLoading={actionLoading}
              onMarkPaid={() => patchBill({ status: 'settled', paid_date: today }, 'paid')}
              onToggleFavorite={() => patchBill({ is_favorite: !bill.is_favorite }, 'favorite')}
              onDelete={deleteBill}
              onDraftLetter={() => setDraftLetterOpen(true)}
            />
          )}
          {activeTab === 'notitie' && (
            <NotesTab
              notes={notes}
              setNotes={setNotes}
              saving={notesSaving}
              saved={notesSaved}
              onSave={saveNotes}
              t={t}
            />
          )}
        </div>
      </div>

      {/* Draft Letter Modal */}
      <DraftLetterDrawer
        bill={bill}
        open={draftLetterOpen}
        onClose={() => setDraftLetterOpen(false)}
      />
    </>
  );
}

/* ============================================================
   DETAILS TAB
   ============================================================ */
function DetailsTab({ bill, t }: { bill: Bill; t: ReturnType<typeof useTranslations> }) {
  const dueFormatted = new Date(bill.due_date + 'T00:00:00').toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const receivedFormatted = new Date(bill.received_date + 'T00:00:00').toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-3">
      <DetailRow icon={Calendar} label={t('dueDate')} value={dueFormatted} />
      <DetailRow icon={Calendar} label={t('receivedDate')} value={receivedFormatted} />
      <DetailRow icon={Tag} label={t('category')} value={bill.category} />
      <DetailRow icon={FileText} label={t('source')} value={t(`source_${bill.source}`)} />

      {bill.reference && (
        <DetailRow icon={Hash} label={t('reference')} value={bill.reference} copyable />
      )}

      {bill.iban && (
        <DetailRow icon={CreditCard} label="IBAN" value={bill.iban} copyable />
      )}

      {bill.payment_url && (
        <a
          href={bill.payment_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-press flex items-center gap-2 rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 text-[13px] font-semibold text-pw-blue"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
          {t('openPaymentLink')}
        </a>
      )}

      {bill.paid_date && (
        <DetailRow
          icon={Check}
          label={t('paidOn')}
          value={new Date(bill.paid_date + 'T00:00:00').toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        />
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  copyable = false,
}: {
  icon: React.ComponentType<Record<string, unknown>>;
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
          {copied ? (
            <Check className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
          ) : (
            <Copy className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      )}
    </div>
  );
}

/* ============================================================
   ACTIONS TAB
   ============================================================ */
function ActionsTab({
  bill,
  t,
  isPaid,
  actionLoading,
  onMarkPaid,
  onToggleFavorite,
  onDelete,
  onDraftLetter,
}: {
  bill: Bill;
  t: ReturnType<typeof useTranslations>;
  isPaid: boolean;
  actionLoading: string | null;
  onMarkPaid: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onDraftLetter: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Mark as paid */}
      {!isPaid && (
        <button
          onClick={onMarkPaid}
          disabled={actionLoading === 'paid'}
          className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-green/30 bg-green-50/50 px-4 py-3.5 text-left transition-colors hover:bg-green-50 disabled:opacity-50"
        >
          {actionLoading === 'paid' ? (
            <Loader2 className="h-5 w-5 animate-spin text-pw-green" strokeWidth={1.5} />
          ) : (
            <Check className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
          )}
          <div>
            <p className="text-[14px] font-semibold text-pw-green">{t('markAsPaid')}</p>
            <p className="text-[11px] text-pw-muted">{t('markAsPaidDesc')}</p>
          </div>
        </button>
      )}

      {/* Draft letter */}
      {!isPaid && (
        <button
          onClick={onDraftLetter}
          className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-purple/30 bg-purple-50/30 px-4 py-3.5 text-left transition-colors hover:bg-purple-50/50"
        >
          <FileText className="h-5 w-5 text-pw-purple" strokeWidth={1.5} />
          <div>
            <p className="text-[14px] font-semibold text-pw-purple">{t('draftLetter')}</p>
            <p className="text-[11px] text-pw-muted">{t('draftLetterDesc')}</p>
          </div>
        </button>
      )}

      {/* Toggle favorite */}
      <button
        onClick={onToggleFavorite}
        disabled={actionLoading === 'favorite'}
        className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-4 py-3.5 text-left transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        <Star
          className={`h-5 w-5 ${bill.is_favorite ? 'fill-pw-amber text-pw-amber' : 'text-pw-muted'}`}
          strokeWidth={1.5}
        />
        <div>
          <p className="text-[14px] font-semibold text-pw-text">
            {bill.is_favorite ? t('removeFavorite') : t('addFavorite')}
          </p>
          <p className="text-[11px] text-pw-muted">{t('favoriteDesc')}</p>
        </div>
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={actionLoading === 'delete'}
        className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-red/20 bg-red-50/30 px-4 py-3.5 text-left transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        {actionLoading === 'delete' ? (
          <Loader2 className="h-5 w-5 animate-spin text-pw-red" strokeWidth={1.5} />
        ) : (
          <Trash2 className="h-5 w-5 text-pw-red" strokeWidth={1.5} />
        )}
        <div>
          <p className="text-[14px] font-semibold text-pw-red">{t('deleteBill')}</p>
          <p className="text-[11px] text-pw-muted">{t('deleteBillDesc')}</p>
        </div>
      </button>
    </div>
  );
}

/* ============================================================
   NOTES TAB
   ============================================================ */
function NotesTab({
  notes,
  setNotes,
  saving,
  saved,
  onSave,
  t,
}: {
  notes: string;
  setNotes: (v: string) => void;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        placeholder={t('notesPlaceholder')}
        className="w-full resize-none rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
      />
      <button
        onClick={onSave}
        disabled={saving}
        className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : saved ? (
          <Check className="h-4 w-4" strokeWidth={1.5} />
        ) : null}
        {saved ? t('notesSaved') : t('saveNotes')}
      </button>
    </div>
  );
}
