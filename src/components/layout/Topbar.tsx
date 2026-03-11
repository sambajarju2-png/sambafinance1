'use client'

import { Search, Bell, Plus } from 'lucide-react'
import HouseholdSwitcher, { type Household } from './HouseholdSwitcher'
import type { ViewId } from './Sidebar'

interface TopbarProps {
  activeView: ViewId
  household: Household
  onHouseholdChange: (hh: Household) => void
  onSearch: (query: string) => void
  searchQuery: string
}

const VIEW_TITLES: Record<ViewId, string> = {
  dashboard: 'Dashboard',
  betalingen: 'Betalingen',
  statistieken: 'Statistieken',
  cashflow: 'Cashflow',
  instellingen: 'Instellingen',
}

export default function Topbar({
  activeView,
  household,
  onHouseholdChange,
  onSearch,
  searchQuery,
}: TopbarProps) {
  const now = new Date()
  const timeStr = now.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="h-[58px] bg-surface border-b border-border flex items-center px-4 md:px-7 gap-3 md:gap-4 flex-shrink-0 z-40 relative">
      {/* Title — hidden on mobile (bottom nav handles context) */}
      <div className="hidden md:block">
        <div className="text-[14.5px] font-bold text-navy">
          {VIEW_TITLES[activeView]}
        </div>
        <div className="text-[11.5px] text-muted mt-[1px]">
          Bijgewerkt: {timeStr}
        </div>
      </div>

      {/* Mobile: show just the page title */}
      <div className="md:hidden text-[15px] font-bold text-navy">
        {VIEW_TITLES[activeView]}
      </div>

      <div className="flex-1" />

      {/* Search — full width on mobile, constrained on desktop */}
      <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-3 py-[7px] w-full max-w-[180px] md:max-w-[220px] focus-within:border-brand-blue-hover transition-colors">
        <Search className="w-[14px] h-[14px] text-muted-light flex-shrink-0" />
        <input
          type="text"
          placeholder="Zoeken…"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="border-none outline-none bg-transparent text-[13px] text-txt w-full placeholder:text-muted-light font-sans"
        />
      </div>

      {/* Household switcher — hidden on mobile */}
      <div className="hidden lg:block">
        <HouseholdSwitcher
          active={household}
          onChange={onHouseholdChange}
          partnerName="Vrouw"
        />
      </div>

      {/* Notifications */}
      <button className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface text-muted hover:border-border-strong hover:bg-surface-2 hover:text-navy transition-all">
        <Bell className="w-[15px] h-[15px]" />
        <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-status-red rounded-full border-[1.5px] border-surface" />
      </button>

      {/* Sync button — desktop only */}
      <button className="hidden md:flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg bg-navy text-white text-[12.5px] font-semibold hover:bg-navy-light transition-colors">
        <Plus className="w-3.5 h-3.5" />
        Sync
      </button>
    </div>
  )
}
