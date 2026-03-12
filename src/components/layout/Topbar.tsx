'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Bell, Plus, X, AlertTriangle, AlertCircle, CheckCircle2, Mail } from 'lucide-react'
import HouseholdSwitcher, { type Household } from './HouseholdSwitcher'
import type { ViewId } from './Sidebar'
import type { DisplayBill } from '@/lib/bill-utils'
import { formatAmount, daysUntilDate, formatDate } from '@/lib/bill-utils'

interface TopbarProps {
  activeView: ViewId
  household: Household
  onHouseholdChange: (hh: Household) => void
  onSearch: (query: string) => void
  searchQuery: string
  bills?: DisplayBill[]
  onNavigate?: (view: ViewId) => void
  onSyncClick?: () => void
}

const VIEW_TITLES: Record<ViewId, string> = {
  dashboard: 'Dashboard', betalingen: 'Betalingen', statistieken: 'Statistieken',
  cashflow: 'Cashflow', instellingen: 'Instellingen',
}

export default function Topbar({ activeView, household, onHouseholdChange, onSearch, searchQuery, bills = [], onNavigate, onSyncClick }: TopbarProps) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifRead, setNotifRead] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  const timeStr = now.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  // Build notifications from real bill data
  const notifications = bills
    .filter(b => b.status !== 'settled')
    .map(b => {
      const days = daysUntilDate(b.dueDate)
      if (days !== null && days <= 0) return { id: b.id, icon: 'red' as const, text: `**${b.vendor}** — deadline verlopen!`, sub: `${formatAmount(b.amount)} · ${formatDate(b.dueDate)}`, urgent: true }
      if (days !== null && days <= 4) return { id: b.id, icon: 'red' as const, text: `**${b.vendor}** — deadline over ${days} dag${days !== 1 ? 'en' : ''}`, sub: `${formatAmount(b.amount)} · ${formatDate(b.dueDate)}`, urgent: true }
      if (days !== null && days <= 7) return { id: b.id, icon: 'amber' as const, text: `**${b.vendor}** — deadline over ${days} dagen`, sub: `${formatAmount(b.amount)} · ${formatDate(b.dueDate)}`, urgent: false }
      return null
    })
    .filter(Boolean)
    .slice(0, 6) as { id: string; icon: 'red' | 'amber'; text: string; sub: string; urgent: boolean }[]

  const unreadCount = notifRead ? 0 : notifications.filter(n => n.urgent).length

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="h-[58px] bg-surface border-b border-border flex items-center px-4 md:px-7 gap-3 md:gap-4 flex-shrink-0 z-40 relative">
      <div className="hidden md:block">
        <div className="text-[14.5px] font-bold text-navy">{VIEW_TITLES[activeView]}</div>
        <div className="text-[11.5px] text-muted mt-[1px]">Bijgewerkt: {timeStr}</div>
      </div>
      <div className="md:hidden text-[15px] font-bold text-navy">{VIEW_TITLES[activeView]}</div>
      <div className="flex-1" />
      <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-3 py-[7px] w-full max-w-[180px] md:max-w-[220px] focus-within:border-brand-blue-hover transition-colors">
        <Search className="w-[14px] h-[14px] text-muted-light flex-shrink-0" />
        <input type="text" placeholder="Zoeken…" value={searchQuery} onChange={e => onSearch(e.target.value)} className="border-none outline-none bg-transparent text-[13px] text-txt w-full placeholder:text-muted-light font-sans" />
      </div>
      <div className="hidden lg:block"><HouseholdSwitcher active={household} onChange={onHouseholdChange} partnerName="Vrouw" /></div>

      {/* Notification bell */}
      <div ref={panelRef} className="relative">
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface text-muted hover:border-border-strong hover:bg-surface-2 hover:text-navy transition-all"
        >
          <Bell className="w-[15px] h-[15px]" />
          {unreadCount > 0 && <span className="absolute top-1 right-1 w-[8px] h-[8px] bg-status-red rounded-full border-[1.5px] border-surface" />}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-[340px] bg-surface border border-border rounded-xl shadow-elevated z-[200] overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-[13px] font-extrabold text-navy">Meldingen</span>
              <button onClick={() => { setNotifRead(true) }} className="text-[11.5px] text-brand-blue font-semibold hover:text-brand-blue-hover transition-colors">
                Alles gelezen
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-status-green mx-auto mb-2" />
                <p className="text-[13px] text-muted">Geen openstaande meldingen</p>
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto">
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => { setNotifOpen(false); onNavigate?.('betalingen') }}
                    className="w-full flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-bg transition-colors text-left"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${n.icon === 'red' ? 'bg-status-red-pale' : 'bg-status-amber-pale'}`}>
                      {n.icon === 'red' ? <AlertTriangle className="w-3.5 h-3.5 text-status-red" /> : <AlertCircle className="w-3.5 h-3.5 text-status-amber" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] text-navy leading-snug" dangerouslySetInnerHTML={{ __html: n.text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                      <div className="text-[11px] text-muted-light mt-1">{n.sub}</div>
                    </div>
                    {n.urgent && !notifRead && <span className="w-[6px] h-[6px] bg-brand-blue rounded-full flex-shrink-0 mt-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button onClick={() => onSyncClick?.()} className="hidden md:flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg bg-navy text-white text-[12.5px] font-semibold hover:bg-navy-light transition-colors">
        <Plus className="w-3.5 h-3.5" /> Sync
      </button>
    </div>
  )
}
