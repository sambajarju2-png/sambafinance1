'use client'

export type StatusTab = 'open' | 'paid' | 'archive'
export type UrgencyTab = 'all' | 'critical' | 'warn' | 'info'
export type SortOption = 'urgency' | 'amount-desc' | 'amount-asc' | 'deadline' | 'sender'

interface FilterBarProps {
  statusTab: StatusTab
  urgencyTab: UrgencyTab
  sortOption: SortOption
  counts: {
    open: number
    paid: number
    critical: number
    warn: number
    info: number
  }
  onStatusChange: (tab: StatusTab) => void
  onUrgencyChange: (tab: UrgencyTab) => void
  onSortChange: (sort: SortOption) => void
}

export default function FilterBar({
  statusTab,
  urgencyTab,
  sortOption,
  counts,
  onStatusChange,
  onUrgencyChange,
  onSortChange,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-2.5 px-4 md:px-5 pt-3.5 flex-wrap">
      {/* Status tabs */}
      <div className="flex gap-[2px] bg-surface-2 border border-border rounded-[9px] p-[3px]">
        {([
          { id: 'open' as StatusTab, label: 'Openstaand', count: counts.open },
          { id: 'paid' as StatusTab, label: 'Afgehandeld', count: counts.paid },
          { id: 'archive' as StatusTab, label: 'Archief', count: 0 },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => onStatusChange(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium
              transition-all whitespace-nowrap
              ${statusTab === tab.id
                ? 'bg-surface text-navy font-bold shadow-card'
                : 'text-muted hover:text-navy'
              }
            `}
          >
            {tab.label}
            <span
              className={`
                text-[10px] font-bold px-1.5 py-[1px] rounded-lg
                ${statusTab === tab.id
                  ? 'bg-brand-blue-pale text-brand-blue'
                  : 'bg-border text-muted'
                }
              `}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Urgency tabs — only visible when status=open */}
      {statusTab === 'open' && (
        <div className="flex gap-[2px] bg-surface-2 border border-border rounded-[9px] p-[3px]">
          {([
            { id: 'all' as UrgencyTab, label: 'Alles', count: counts.open },
            { id: 'critical' as UrgencyTab, label: '🚨 Kritiek', count: counts.critical },
            { id: 'warn' as UrgencyTab, label: '⚠️ Binnenkort', count: counts.warn },
            { id: 'info' as UrgencyTab, label: '🔵 Overig', count: counts.info },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => onUrgencyChange(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium
                transition-all whitespace-nowrap
                ${urgencyTab === tab.id
                  ? 'bg-surface text-navy font-bold shadow-card'
                  : 'text-muted hover:text-navy'
                }
              `}
            >
              {tab.label}
              <span
                className={`
                  text-[10px] font-bold px-1.5 py-[1px] rounded-lg
                  ${urgencyTab === tab.id
                    ? 'bg-brand-blue-pale text-brand-blue'
                    : 'bg-border text-muted'
                  }
                `}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Sort dropdown */}
      <select
        value={sortOption}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="px-3 py-[7px] border border-border rounded-lg text-[12.5px] text-muted bg-surface cursor-pointer outline-none hover:border-border-strong transition-colors font-sans"
      >
        <option value="urgency">Sorteren: Urgentie</option>
        <option value="amount-desc">Bedrag (hoog–laag)</option>
        <option value="amount-asc">Bedrag (laag–hoog)</option>
        <option value="deadline">Deadline</option>
        <option value="sender">Afzender</option>
      </select>
    </div>
  )
}
