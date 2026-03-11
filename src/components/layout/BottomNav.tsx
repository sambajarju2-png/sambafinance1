'use client'

import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  TrendingUp,
  Settings,
} from 'lucide-react'
import type { ViewId } from './Sidebar'

interface BottomNavProps {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
  billCount: number
}

const ITEMS: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Overzicht', icon: LayoutDashboard },
  { id: 'betalingen', label: 'Betalingen', icon: Receipt },
  { id: 'statistieken', label: 'Stats', icon: BarChart3 },
  { id: 'cashflow', label: 'Cashflow', icon: TrendingUp },
  { id: 'instellingen', label: 'Instellingen', icon: Settings },
]

export default function BottomNav({ activeView, onNavigate, billCount }: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-border z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-[60px] px-1">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                relative flex flex-col items-center justify-center gap-0.5 flex-1
                py-1.5 transition-colors
                ${isActive ? 'text-brand-blue' : 'text-muted'}
              `}
            >
              <div className="relative">
                <Icon className="w-[20px] h-[20px]" />
                {item.id === 'betalingen' && billCount > 0 && (
                  <span className="absolute -top-1 -right-2.5 bg-status-red text-white text-[8px] font-bold px-1 py-[0.5px] rounded-full min-w-[14px] text-center">
                    {billCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[2.5px] bg-brand-blue rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
