'use client'

import { useEffect, useState, useMemo } from 'react'
import { TrendingDown, Clock, FileText } from 'lucide-react'
import CategoryDonut from '@/components/ui/CategoryDonut'
import BudgetBars from '@/components/ui/BudgetBars'
import { CATEGORY_DATA } from '@/lib/mock-data'
import type { DisplayBill } from '@/lib/bill-utils'
import { formatAmount } from '@/lib/bill-utils'

interface StatistiekenViewProps {
  bills: DisplayBill[]
}

export default function StatistiekenView({ bills }: StatistiekenViewProps) {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const totalOutstanding = useMemo(() => {
    return bills.reduce((s, b) => s + (b.amount ?? 0), 0)
  }, [bills])

  return (
    <>
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
        <MetricCard
          value={formatAmount(totalOutstanding)}
          label="Totaal openstaand"
          sub="Alle accounts gecombineerd"
          icon={<TrendingDown className="w-4 h-4 text-status-red" />}
          delay={0}
        />
        <MetricCard
          value="4,2 dagen"
          label="Gem. betalingstermijn"
          sub="Na ontvangst factuur"
          icon={<Clock className="w-4 h-4 text-brand-blue" />}
          delay={80}
          progressBar={{ pct: 42, color: 'bg-brand-blue' }}
        />
        <MetricCard
          value="12"
          label="Facturen deze maand"
          sub="+3 vs. vorige maand"
          icon={<FileText className="w-4 h-4 text-status-green" />}
          delay={160}
        />
      </div>

      {/* Two column: donut + budget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Category chart */}
        <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="px-5 py-[18px] border-b border-border">
            <div className="text-[13.5px] font-bold text-navy">Categoriegrafiek</div>
          </div>
          <div className="px-5 py-5">
            <CategoryDonut
              data={CATEGORY_DATA.map((c) => ({ name: c.name, amount: c.amount, color: c.color }))}
              size={130}
              strokeWidth={18}
            />
          </div>
        </div>

        {/* Budget vs actual */}
        <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-fade-up" style={{ animationDelay: '280ms' }}>
          <div className="px-5 py-[18px] border-b border-border">
            <div className="text-[13.5px] font-bold text-navy">Budget vs. Werkelijk</div>
          </div>
          <div className="px-5 py-5">
            <BudgetBars data={CATEGORY_DATA} />
          </div>
        </div>
      </div>

      {/* Payment speed insights */}
      <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-fade-up" style={{ animationDelay: '360ms' }}>
        <div className="px-5 py-[18px] border-b border-border">
          <div className="text-[13.5px] font-bold text-navy">Betalingssnelheid per categorie</div>
          <div className="text-[12px] text-muted mt-[2px]">Gemiddeld aantal dagen tot betaling na ontvangst</div>
        </div>
        <div className="px-5 py-5 space-y-3">
          {[
            { name: 'Zakelijk', days: 2.1, color: '#2563EB' },
            { name: 'Energie', days: 5.3, color: '#D97706' },
            { name: 'Telecom', days: 3.8, color: '#0369A1' },
            { name: 'Zorgverzekering', days: 4.0, color: '#059669' },
            { name: 'Lease', days: 1.5, color: '#7C3AED' },
            { name: 'Incasso', days: 8.7, color: '#DC2626' },
            { name: 'Software', days: 6.2, color: '#94A3B8' },
          ].map((item) => {
            const pct = Math.min((item.days / 14) * 100, 100)
            return (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-[12.5px] font-semibold text-navy w-[120px] flex-shrink-0 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  {item.name}
                </span>
                <div className="flex-1 h-[6px] bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: animate ? `${pct}%` : '0%',
                      background: item.days > 7 ? '#DC2626' : item.days > 5 ? '#D97706' : item.color,
                    }}
                  />
                </div>
                <span className={`text-[12px] font-bold w-[60px] text-right ${item.days > 7 ? 'text-status-red' : item.days > 5 ? 'text-status-amber' : 'text-navy'}`}>
                  {item.days} dagen
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ──

function MetricCard({
  value,
  label,
  sub,
  icon,
  delay = 0,
  progressBar,
}: {
  value: string
  label: string
  sub: string
  icon: React.ReactNode
  delay?: number
  progressBar?: { pct: number; color: string }
}) {
  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), delay + 100)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className="bg-surface border border-border rounded-card p-[18px] shadow-card animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-[28px] font-extrabold text-navy tracking-tight leading-none">
          {value}
        </div>
        <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </div>
      <div className="text-[11.5px] font-semibold text-muted">{label}</div>
      <div className="text-[11px] text-muted-light mt-[3px]">{sub}</div>
      {progressBar && (
        <div className="mt-3 h-[6px] bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${progressBar.color}`}
            style={{ width: animate ? `${progressBar.pct}%` : '0%' }}
          />
        </div>
      )}
    </div>
  )
}
