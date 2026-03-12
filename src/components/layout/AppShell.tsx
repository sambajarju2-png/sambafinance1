'use client'

import { useState, type ReactNode } from 'react'
import Sidebar, { type ViewId } from './Sidebar'
import Topbar from './Topbar'
import BottomNav from './BottomNav'
import type { Household } from './HouseholdSwitcher'
import type { DisplayBill } from '@/lib/bill-utils'

interface AppShellProps {
  children: (context: {
    activeView: ViewId
    household: Household
    searchQuery: string
    onNavigate: (view: ViewId) => void
    settingsTab: string | null
  }) => ReactNode
  billCount: number
  bills?: DisplayBill[]
  userName?: string
  userEmail?: string
  onSignOut?: () => void
}

export default function AppShell({ children, billCount, bills = [], userName, userEmail, onSignOut }: AppShellProps) {
  const [activeView, setActiveView] = useState<ViewId>('dashboard')
  const [household, setHousehold] = useState<Household>('joint')
  const [searchQuery, setSearchQuery] = useState('')
  const [settingsTab, setSettingsTab] = useState<string | null>(null)

  function handleNavigate(view: ViewId) {
    if (view !== 'instellingen') setSettingsTab(null)
    setActiveView(view)
  }

  function handleSyncClick() {
    setSettingsTab('sync')
    setActiveView('instellingen')
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={handleNavigate} billCount={billCount} userName={userName} userEmail={userEmail} onSignOut={onSignOut} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          activeView={activeView} household={household} onHouseholdChange={setHousehold}
          onSearch={setSearchQuery} searchQuery={searchQuery} bills={bills} onNavigate={handleNavigate} onSyncClick={handleSyncClick}
        />
        <main className="flex-1 overflow-y-auto pb-[76px] md:pb-10">
          <div className="px-4 md:px-7 py-5 md:py-7">
            {children({ activeView, household, searchQuery, onNavigate: handleNavigate, settingsTab })}
          </div>
        </main>
      </div>
      <BottomNav activeView={activeView} onNavigate={handleNavigate} billCount={billCount} />
    </div>
  )
}
