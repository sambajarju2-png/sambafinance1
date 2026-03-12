'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Bell, Plus, X, AlertTriangle, Clock, Check } from 'lucide-react'
import HouseholdSwitcher, { type Household } from './HouseholdSwitcher'
import type { ViewId } from './Sidebar'

interface Notification {
  id: string
  type: 'critical' | 'warn' | 'info'
  title: string
  message: string
  time: string
}

interface TopbarProps {
  activeView: ViewId
  household: Household
  onHouseholdChange: (hh: Household) => void
  onSearch: (query: string) => void
  searchQuery: string
  notifications?: Notification[]
  onClearNotifications?: () => void
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
  notifications = [],
  onClearNotifications,
}: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNotifications])

  const now = new Date()
  const timeStr = now.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const unreadCount = notifications.length

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
      <div className="relative" ref={notifRef}>
        <button 
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface text-muted hover:border-border-strong hover:bg-surface-2 hover:text-navy transition-all"
        >
          <Bell className="w-[15px] h-[15px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-status-red rounded-full border-[1.5px] border-surface" />
          )}
        </button>

        {/* Notification Panel */}
        {showNotifications && (
          <div className="absolute right-0 top-full mt-2 w-[320px] bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-fade-up">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-[13px] font-bold text-navy">Meldingen</span>
              {notifications.length > 0 && onClearNotifications && (
                <button 
                  onClick={() => { onClearNotifications(); setShowNotifications(false) }}
                  className="text-[11px] text-muted hover:text-brand-blue font-medium"
                >
                  Alles wissen
                </button>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Check className="w-8 h-8 text-status-green mx-auto mb-2" />
                  <p className="text-[13px] font-medium text-navy">Geen nieuwe meldingen</p>
                  <p className="text-[11px] text-muted mt-1">Je bent helemaal bij!</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className="px-4 py-3 border-b border-border last:border-b-0 hover:bg-bg transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        notif.type === 'critical' ? 'bg-status-red-pale' :
                        notif.type === 'warn' ? 'bg-status-amber-pale' : 'bg-brand-blue-pale'
                      }`}>
                        {notif.type === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-status-red" />
                        ) : (
                          <Clock className="w-4 h-4 text-status-amber" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-navy">{notif.title}</p>
                        <p className="text-[11.5px] text-muted mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-[10.5px] text-muted-light mt-1">{notif.time}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sync button — desktop only */}
      <button className="hidden md:flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg bg-navy text-white text-[12.5px] font-semibold hover:bg-navy-light transition-colors">
        <Plus className="w-3.5 h-3.5" />
        Sync
      </button>
    </div>
  )
}
