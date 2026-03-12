'use client'

import { useMemo, useState, useCallback } from 'react'
import { AlertTriangle, AlertCircle, RotateCcw, ClipboardList, Pencil, Sparkles, Loader2, ArrowRight, ShieldAlert, Lightbulb, Target } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import CategoryDonut from '@/components/ui/CategoryDonut'
import CashflowMini from '@/components/ui/CashflowMini'
import BudgetBars from '@/components/ui/BudgetBars'
import type { DisplayBill } from '@/lib/bill-utils'
import { CASHFLOW_DATA, CATEGORY_DATA } from '@/lib/mock-data'

interface DashboardViewProps {
  bills: DisplayBill[]
  paidBills: DisplayBill[]
  accessToken?: string
}

const INSIGHT_ICONS: Record<string, typeof Target> = { priority: Target, saving: Lightbulb, risk: ShieldAlert, tip: Sparkles }
const INSIGHT_COLORS: Record<string, { bg: string; text: string }> = {
  priority: { bg: 'bg-status-red-pale', text: 'text-status-red' },
  saving: { bg: 'bg-status-green-pale', text: 'text-status-green' },
  risk: { bg: 'bg-status-amber-pale', text: 'text-status-amber' },
  tip: { bg: 'bg-brand-blue-pale', text: 'text-brand-blue' },
  success: { bg: 'bg-status-green-pale', text: 'text-status-green' },
}

export default function DashboardView({ bills, paidBills, accessToken }: DashboardViewProps) {
  const [insights, setInsights] = useState<{ type: string; title: string; text: string }[] | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)

  const stats = useMemo(() => {
    const critical = bills.filter(b => b.urgency === 'critical')
    const warn = bills.filter(b => b.urgency === 'warn')
    const failed = bills.filter(b => b.description.toLowerCase().includes('mislukt') || b.description.toLowerCase().includes('stornering'))
    const sum = (arr: DisplayBill[]) => arr.reduce((s, b) => s + (b.amount ?? 0), 0)
    return { criticalAmount: sum(critical), criticalCount: critical.length, warnAmount: sum(warn), warnCount: warn.length, failedCount: failed.length, totalAmount: sum(bills), totalCount: bills.length }
  }, [bills])

  const categoryData = useMemo(() => {
    const catMap: Record<string, { amount: number; color: string; budget: number }> = {}
    const colorMap: Record<string, string> = {}; const budgetMap: Record<string, number> = {}
    CATEGORY_DATA.forEach(c => { colorMap[c.name] = c.color; budgetMap[c.name] = c.budget })
    bills.forEach(b => {
      if (!catMap[b.category]) catMap[b.category] = { amount: 0, color: colorMap[b.category] || '#94A3B8', budget: budgetMap[b.category] || 50000 }
      catMap[b.category].amount += b.amount ?? 0
    })
    return Object.entries(catMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount)
  }, [bills])

  const fetchInsights = useCallback(async () => {
    if (!accessToken) return
    setInsightsLoading(true); setInsightsError(null)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok && data.insights) setInsights(data.insights)
      else setInsightsError(data.error || 'Kon geen inzichten genereren')
    } catch { setInsightsError('Verbindingsfout') }
    finally { setInsightsLoading(false) }
  }, [accessToken])

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-3.5 mb-6">
        <StatCard label="Kritiek ≤ 4 dagen" value={stats.criticalAmount} prefix="€ " subtitle={`${stats.criticalCount} betalingen · deadline deze week`} accent="red" icon={<AlertTriangle className="w-[15px] h-[15px] text-status-red" />} delay={0} />
        <StatCard label="Binnenkort 5–14d" value={stats.warnAmount} prefix="€ " subtitle={`${stats.warnCount} betalingen openstaand`} accent="amber" icon={<AlertCircle className="w-[15px] h-[15px] text-status-amber" />} delay={60} />
        <StatCard label="Mislukte betalingen" value={stats.failedCount} subtitle="Kaart of saldo probleem" accent="blue" icon={<RotateCcw className="w-[15px] h-[15px] text-brand-blue" />} delay={120} isInteger />
        <StatCard label="Totaal openstaand" value={stats.totalAmount} prefix="€ " subtitle={`${stats.totalCount} items · beide accounts`} accent="green" icon={<ClipboardList className="w-[15px] h-[15px] text-status-green" />} delay={180} />
      </div>

      {/* AI Insights */}
      <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden mb-6 animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="px-5 py-[18px] border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-status-purple" />
            <div className="text-[13.5px] font-bold text-navy">AI Financieel Inzicht</div>
          </div>
          <button onClick={fetchInsights} disabled={insightsLoading} className="flex items-center gap-1.5 px-3 py-[6px] rounded-lg bg-navy text-white text-[12px] font-semibold hover:bg-navy-light disabled:opacity-60 transition-colors">
            {insightsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {insightsLoading ? 'Analyseren...' : insights ? 'Vernieuw' : 'Analyseer mijn rekeningen'}
          </button>
        </div>
        <div className="px-5 py-4">
          {!insights && !insightsLoading && !insightsError && (
            <p className="text-[13px] text-muted">Klik op &quot;Analyseer mijn rekeningen&quot; voor gepersonaliseerd financieel advies op basis van je openstaande betalingen.</p>
          )}
          {insightsError && <p className="text-[13px] text-status-red">{insightsError}</p>}
          {insights && (
            <div className="space-y-3">
              {insights.map((insight, i) => {
                const Icon = INSIGHT_ICONS[insight.type] || Sparkles
                const colors = INSIGHT_COLORS[insight.type] || INSIGHT_COLORS.tip
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-bg border border-border rounded-lg">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                      <Icon className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-navy">{insight.title}</div>
                      <div className="text-[12.5px] text-muted mt-0.5 leading-relaxed">{insight.text}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 mb-6">
        <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-fade-up" style={{ animationDelay: '240ms' }}>
          <div className="px-5 py-[18px] border-b border-border"><div className="text-[13.5px] font-bold text-navy">Categorieoverzicht</div><div className="text-[12px] text-muted mt-[2px]">Verdeling openstaande bedragen</div></div>
          <div className="px-5 py-[18px]"><CategoryDonut data={categoryData.map(c => ({ name: c.name, amount: c.amount, color: c.color }))} /></div>
        </div>
        <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-fade-up" style={{ animationDelay: '300ms' }}>
          <div className="px-5 py-[18px] border-b border-border"><div className="text-[13.5px] font-bold text-navy">Cashflow voorspelling</div><div className="text-[12px] text-muted mt-[2px]">Verwachte uitgaven komende maanden</div></div>
          <div className="px-5 py-5"><CashflowMini data={CASHFLOW_DATA} /></div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-fade-up" style={{ animationDelay: '360ms' }}>
        <div className="px-5 py-[18px] border-b border-border flex items-center justify-between">
          <div><div className="text-[13.5px] font-bold text-navy">Budget per categorie</div><div className="text-[12px] text-muted mt-[2px]">Maandbudget vs. werkelijke uitgaven</div></div>
          <button className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg border border-border bg-surface text-muted text-[12.5px] font-semibold hover:border-border-strong hover:bg-surface-2 hover:text-navy transition-all"><Pencil className="w-3 h-3" /> Beheer budgets</button>
        </div>
        <div className="px-5 py-5"><BudgetBars data={categoryData} /></div>
      </div>
    </>
  )
}
