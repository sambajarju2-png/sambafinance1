'use client'

import { useMemo } from 'react'
import { AlertTriangle, AlertCircle, RotateCcw, ClipboardList, Pencil } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import CategoryDonut from '@/components/ui/CategoryDonut'
import CashflowMini from '@/components/ui/CashflowMini'
import BudgetBars from '@/components/ui/BudgetBars'
import type { DisplayBill } from '@/lib/bill-utils'
import { CASHFLOW_DATA, CATEGORY_DATA } from '@/lib/mock-data'

interface DashboardViewProps {
  bills: DisplayBill[]
  paidBills: DisplayBill[]
}

export default function DashboardView({ bills, paidBills }: DashboardViewProps) {
  const stats = useMemo(() => {
    const critical = bills.filter((b) => b.urgency === 'critical')
    const warn = bills.filter((b) => b.urgency === 'warn')
    const failed = bills.filter((b) =>
      b.description.toLowerCase().includes('mislukt') || b.description.toLowerCase().includes('stornering')
    )
    const sum = (arr: DisplayBill[]) => arr.reduce((s, b) => s + (b.amount ?? 0), 0)

    return {
      criticalAmount: sum(critical),
      criticalCount: critical.length,
      warnAmount: sum(warn),
      warnCount: warn.length,
      failedCount: failed.length,
      totalAmount: sum(bills),
      totalCount: bills.length,
    }
  }, [bills])

  // Compute category data from live bills
  const categoryData = useMemo(() => {
    const catMap: Record<string, { amount: number; color: string; budget: number }> = {}
    const colorMap: Record<string, string> = {}
    const budgetMap: Record<string, number> = {}
    CATEGORY_DATA.forEach((c) => { colorMap[c.name] = c.color; budgetMap[c.name] = c.budget })

    bills.forEach((b) => {
      if (!catMap[b.category]) {
        catMap[b.category] = {
          amount: 0,
          color: colorMap[b.category] || '#94A3B8',
          budget: budgetMap[b.category] || 50000,
        }
      }
      catMap[b.category].amount += b.amount ?? 0
    })

    return Object.entries(catMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
  }, [bills])

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
            <CategoryDonut data={categoryData.map((c) => ({ name: c.name, amount: c.amount, color: c.color }))} />
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
          <BudgetBars data={categoryData} />
        </div>
      </div>
    </>
  )
}
