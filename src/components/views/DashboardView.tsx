'use client'

import { AlertTriangle, AlertCircle, RotateCcw, ClipboardList, Pencil } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import CategoryDonut from '@/components/ui/CategoryDonut'
import CashflowMini from '@/components/ui/CashflowMini'
import BudgetBars from '@/components/ui/BudgetBars'
import {
  MOCK_BILLS,
  CATEGORY_DATA,
  CASHFLOW_DATA,
  getStats,
  formatAmount,
} from '@/lib/mock-data'

export default function DashboardView() {
  const stats = getStats(MOCK_BILLS)

  return (
    <>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-3.5 mb-6">
        <StatCard
          label="Kritiek ≤ 4 dagen"
          value={stats.criticalAmount}
          prefix="€ "
          subtitle={`${stats.criticalCount} betalingen · deadline deze week`}
          accent="red"
          icon={<AlertTriangle className="w-[15px] h-[15px] text-status-red" />}
          delay={0}
        />
        <StatCard
          label="Binnenkort 5–14d"
          value={stats.warnAmount}
          prefix="€ "
          subtitle={`${stats.warnCount} betalingen openstaand`}
          accent="amber"
          icon={<AlertCircle className="w-[15px] h-[15px] text-status-amber" />}
          delay={60}
        />
        <StatCard
          label="Mislukte betalingen"
          value={stats.failedCount}
          subtitle="Kaart of saldo probleem"
          accent="blue"
          icon={<RotateCcw className="w-[15px] h-[15px] text-brand-blue" />}
          delay={120}
          isInteger
        />
        <StatCard
          label="Totaal openstaand"
          value={stats.totalAmount}
          prefix="€ "
          subtitle={`${stats.totalCount} items · beide accounts`}
          accent="green"
          icon={<ClipboardList className="w-[15px] h-[15px] text-status-green" />}
          delay={180}
        />
      </div>

      {/* Two column: Donut + Cashflow */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 mb-6">
        {/* Category Donut */}
        <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-fade-up" style={{ animationDelay: '240ms' }}>
          <div className="px-5 py-[18px] border-b border-border">
            <div className="text-[13.5px] font-bold text-navy">Categorieoverzicht</div>
            <div className="text-[12px] text-muted mt-[2px]">Verdeling openstaande bedragen</div>
          </div>
          <div className="px-5 py-[18px]">
            <CategoryDonut data={CATEGORY_DATA.map((c) => ({ name: c.name, amount: c.amount, color: c.color }))} />
          </div>
        </div>

        {/* Cashflow Mini */}
        <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-fade-up" style={{ animationDelay: '300ms' }}>
          <div className="px-5 py-[18px] border-b border-border">
            <div className="text-[13.5px] font-bold text-navy">Cashflow voorspelling</div>
            <div className="text-[12px] text-muted mt-[2px]">Verwachte uitgaven komende maanden</div>
          </div>
          <div className="px-5 py-5">
            <CashflowMini data={CASHFLOW_DATA} />
          </div>
        </div>
      </div>

      {/* Budget bars */}
      <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-fade-up" style={{ animationDelay: '360ms' }}>
        <div className="px-5 py-[18px] border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[13.5px] font-bold text-navy">Budget per categorie</div>
            <div className="text-[12px] text-muted mt-[2px]">Maandbudget vs. werkelijke uitgaven</div>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg border border-border bg-surface text-muted text-[12.5px] font-semibold hover:border-border-strong hover:bg-surface-2 hover:text-navy transition-all">
            <Pencil className="w-3 h-3" />
            Beheer budgets
          </button>
        </div>
        <div className="px-5 py-5">
          <BudgetBars data={CATEGORY_DATA} />
        </div>
      </div>
    </>
  )
}
