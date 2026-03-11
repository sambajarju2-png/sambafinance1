'use client'

import { Check, ChevronRight } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import type { DisplayBill } from '@/lib/bill-utils'
import { formatAmount, formatDate, daysUntilDate as daysUntil } from '@/lib/bill-utils'

interface BillTableProps {
  bills: DisplayBill[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onMarkPaid: (id: string) => void
  onOpenDrawer: (bill: DisplayBill) => void
  allSelected: boolean
}

export default function BillTable({
  bills,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onMarkPaid,
  onOpenDrawer,
  allSelected,
}: BillTableProps) {
  if (bills.length === 0) {
    return (
      <div className="text-center py-16 text-muted-light text-[13px]">
        Geen betalingen gevonden
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      {/* Desktop table */}
      <table className="w-full border-collapse hidden md:table">
        <thead>
          <tr>
            <th className="bg-bg px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border sticky top-0 z-[5] w-10">
              <Checkbox
                checked={allSelected && bills.length > 0}
                onChange={onToggleSelectAll}
              />
            </th>
            <th className="bg-bg px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border sticky top-0 z-[5]">
              Betaler
            </th>
            <th className="bg-bg px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border sticky top-0 z-[5]">
              Categorie
            </th>
            <th className="bg-bg px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border sticky top-0 z-[5]">
              Deadline
            </th>
            <th className="bg-bg px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border sticky top-0 z-[5]">
              Status
            </th>
            <th className="bg-bg px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border sticky top-0 z-[5] pr-5">
              Bedrag
            </th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => {
            const selected = selectedIds.has(bill.id)
            const days = daysUntil(bill.dueDate)
            const isPaid = bill.status === 'settled'

            return (
              <tr
                key={bill.id}
                className={`
                  border-b border-border transition-colors cursor-pointer
                  ${selected ? 'bg-brand-blue-pale' : 'hover:bg-[#FAFCFF]'}
                  ${isPaid ? 'opacity-60' : ''}
                `}
                onClick={() => onOpenDrawer(bill)}
              >
                {/* Checkbox */}
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected}
                    onChange={() => onToggleSelect(bill.id)}
                  />
                </td>

                {/* Sender */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-[12px] font-extrabold flex-shrink-0 border border-black/[.06]"
                      style={{ background: bill.avatarBg, color: bill.avatarFg }}
                    >
                      {bill.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-navy flex items-center gap-1.5">
                        <span className="truncate">{bill.vendor}</span>
                        {bill.isDuplicate && (
                          <span className="inline-block text-[9.5px] font-bold px-1.5 py-[1px] bg-[#FEF3C7] text-[#92400E] rounded">
                            ⚠ Duplicaat
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-muted mt-[1px] truncate max-w-[280px]">
                        {bill.description}
                        {isPaid && bill.paidAt && (
                          <span> · Betaald op {formatDate(bill.paidAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td className="px-4 py-3.5">
                  <span className="text-[11.5px] text-muted font-semibold bg-surface-2 border border-border px-2 py-[3px] rounded-md whitespace-nowrap">
                    {bill.category}
                  </span>
                </td>

                {/* Deadline */}
                <td className="px-4 py-3.5">
                  <DeadlineCell date={bill.dueDate} days={days} isPaid={isPaid} paidAt={bill.paidAt} />
                </td>

                {/* Status */}
                <td className="px-4 py-3.5">
                  <StatusBadge urgency={isPaid ? 'paid' : bill.urgency} />
                </td>

                {/* Amount + Actions */}
                <td className="px-4 py-3.5 pr-5">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-[13.5px] font-extrabold text-navy tracking-tight">
                      {formatAmount(bill.amount)}
                    </span>
                    {!isPaid && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onMarkPaid(bill.id) }}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-status-green-mid rounded-md text-[11px] font-semibold text-status-green bg-surface hover:bg-status-green-pale transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Betaald
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenDrawer(bill) }}
                      className="inline-flex items-center justify-center w-7 h-7 border border-border rounded-md text-muted bg-surface hover:bg-bg hover:text-navy transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-border">
        {bills.map((bill) => {
          const days = daysUntil(bill.dueDate)
          const isPaid = bill.status === 'settled'
          const selected = selectedIds.has(bill.id)

          return (
            <div
              key={bill.id}
              onClick={() => onOpenDrawer(bill)}
              className={`
                flex items-center gap-3 px-4 py-3.5 transition-colors cursor-pointer
                ${selected ? 'bg-brand-blue-pale' : 'active:bg-[#FAFCFF]'}
                ${isPaid ? 'opacity-60' : ''}
              `}
            >
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-[13px] font-extrabold flex-shrink-0 border border-black/[.06]"
                style={{ background: bill.avatarBg, color: bill.avatarFg }}
              >
                {bill.initials}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-navy truncate">
                    {bill.vendor}
                  </span>
                  <span className="text-[13.5px] font-extrabold text-navy tracking-tight flex-shrink-0">
                    {formatAmount(bill.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted font-semibold bg-surface-2 border border-border px-1.5 py-[1px] rounded">
                      {bill.category}
                    </span>
                    {days !== null && days <= 4 && !isPaid && (
                      <span className="text-[10px] font-bold px-1.5 py-[1px] rounded-full bg-status-red-mid text-status-red">
                        {days <= 0 ? 'Verlopen' : `${days}d`}
                      </span>
                    )}
                    {days !== null && days > 4 && days <= 10 && !isPaid && (
                      <span className="text-[10px] font-bold px-1.5 py-[1px] rounded-full bg-status-amber-mid text-status-amber">
                        {days}d
                      </span>
                    )}
                  </div>
                  <StatusBadge urgency={isPaid ? 'paid' : bill.urgency} />
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-light flex-shrink-0" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Sub-components ──

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`
        w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all
        ${checked
          ? 'bg-brand-blue border-brand-blue'
          : 'border-[1.5px] border-border-strong hover:border-brand-blue'
        }
      `}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

function DeadlineCell({
  date,
  days,
  isPaid,
  paidAt,
}: {
  date: string | null
  days: number | null
  isPaid: boolean
  paidAt: string | null
}) {
  if (isPaid) {
    return <span className="text-[12.5px] text-muted">{paidAt ? formatDate(paidAt) : '—'}</span>
  }

  const urgClass = days !== null && days <= 4 ? 'text-status-red font-bold' : days !== null && days <= 10 ? 'text-status-amber font-bold' : 'text-muted'

  return (
    <span className="flex items-center gap-1.5">
      <span className={`text-[12.5px] ${urgClass}`}>{formatDate(date)}</span>
      {days !== null && days <= 4 && (
        <span className="text-[10px] font-bold px-1.5 py-[1px] rounded-full bg-status-red-mid text-status-red">
          {days <= 0 ? 'Verlopen' : `${days}d`}
        </span>
      )}
      {days !== null && days > 4 && days <= 10 && (
        <span className="text-[10px] font-bold px-1.5 py-[1px] rounded-full bg-status-amber-mid text-status-amber">
          {days}d
        </span>
      )}
    </span>
  )
}
