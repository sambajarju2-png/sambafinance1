'use client'
import { Check, X } from 'lucide-react'
interface BulkBarProps { count: number; onMarkPaid: () => void; onDeselect: () => void }
export default function BulkBar({ count, onMarkPaid, onDeselect }: BulkBarProps) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2.5 px-4 md:px-5 py-2.5 bg-brand-blue-pale border-b border-brand-blue-mid">
      <span className="text-[13px] font-semibold text-brand-blue">{count} geselecteerd</span>
      <button onClick={onMarkPaid} className="flex items-center gap-1.5 px-3 py-[5px] rounded-md border border-brand-blue-mid bg-surface text-brand-blue text-[12px] font-semibold hover:bg-brand-blue-mid transition-colors"><Check className="w-3 h-3"/>Markeer als betaald</button>
      <button onClick={onDeselect} className="flex items-center gap-1.5 px-3 py-[5px] rounded-md border border-brand-blue-mid bg-surface text-brand-blue text-[12px] font-semibold hover:bg-brand-blue-mid transition-colors">Deselecteer</button>
      <div className="flex-1"/><button onClick={onDeselect} className="text-muted hover:text-txt transition-colors"><X className="w-4 h-4"/></button>
    </div>
  )
}
