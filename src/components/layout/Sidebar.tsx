'use client'

import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  TrendingUp,
  Settings,
  CreditCard,
} from 'lucide-react'

export type ViewId = 'dashboard' | 'betalingen' | 'statistieken' | 'cashflow' | 'instellingen'

interface SidebarProps {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
  billCount: number
}

const NAV_SECTIONS = [
  {
    label: 'Overzicht',
    items: [
      { id: 'dashboard' as ViewId, label: 'Dashboard', icon: LayoutDashboard },
      { id: 'betalingen' as ViewId, label: 'Betalingen', icon: Receipt, showBadge: true },
    ],
  },
  {
    label: 'Inzichten',
    items: [
      { id: 'statistieken' as ViewId, label: 'Statistieken', icon: BarChart3 },
      { id: 'cashflow' as ViewId, label: 'Cashflow', icon: TrendingUp },
    ],
  },
  {
    label: 'Beheer',
    items: [
      { id: 'instellingen' as ViewId, label: 'Instellingen', icon: Settings },
    ],
  },
]

export default function Sidebar({ activeView, onNavigate, billCount }: SidebarProps) {
  return (
    <aside className="hidden md:flex w-[232px] bg-navy flex-col flex-shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="px-5 pt-6 pb-[18px] flex items-center gap-2.5 border-b border-white/[.08]">
        <div className="w-[30px] h-[30px] bg-gradient-to-br from-brand-blue-hover to-blue-700 rounded-[7px] flex items-center justify-center shadow-[0_2px_8px_rgba(37,99,235,.45)]">
          <CreditCard className="w-[14px] h-[14px] text-white" />
        </div>
        <span className="text-[15px] font-extrabold text-white tracking-tight">
          Pay<span className="text-blue-400">Watch</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3.5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="px-2.5 mt-4 mb-1.5 first:mt-0 text-[10px] font-bold uppercase tracking-[.1em] text-white/[.28]">
              {section.label}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = activeView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`
                    w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium
                    transition-all duration-150 mb-[1px] text-left
                    ${isActive
                      ? 'bg-blue-500/20 text-white'
                      : 'text-white/[.55] hover:bg-white/[.06] hover:text-white/90'
                    }
                  `}
                >
                  <Icon className={`w-[15px] h-[15px] flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                  {item.label}
                  {item.showBadge && billCount > 0 && (
                    <span className="ml-auto bg-status-red text-white text-[10px] font-bold px-1.5 py-[1px] rounded-full min-w-[18px] text-center">
                      {billCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3.5 py-3.5 border-t border-white/[.08]">
        <div className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] hover:bg-white/[.06] transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-blue-hover to-blue-700 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
            SJ
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-white truncate">Samba Jarju</div>
            <div className="text-[10.5px] text-white/[.38] truncate">sambajarju2@gmail.com</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
