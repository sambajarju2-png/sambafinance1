'use client'

import { useEffect, useState } from 'react'
import { Calendar, CalendarDays, RefreshCw } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import { CASHFLOW_DATA, formatAmount } from '@/lib/mock-data'

const RECURRING = [
  { vendor: 'Odido', initials: 'OD', bg: '#F0FDF4', fg: '#059669', desc: 'Mobiel abonnement', cat: 'Telecom', freq: 'Maandelijks', next: '1 april 2026', amount: 5650 },
  { vendor: 'Hiltermann Lease', initials: 'HL', bg: '#FEF3C7', fg: '#D97706', desc: 'Leasetermijn auto', cat: 'Lease', freq: 'Maandelijks', next: '3 april 2026', amount: 18474 },
  { vendor: 'Anderzorg', initials: 'AZ', bg: '#EDE9FE', fg: '#7C3AED', desc: 'Zorgverzekering', cat: 'Zorg', freq: 'Maandelijks', next: '6 april 2026', amount: 7700 },
  { vendor: 'Eneco', initials: 'EN', bg: '#FDF4FF', fg: '#A21CAF', desc: 'Energierekening', cat: 'Energie', freq: 'Maandelijks', next: '9 april 2026', amount: 21600 },
  { vendor: 'WorkWings', initials: 'WW', bg: '#DBEAFE', fg: '#1D4ED8', desc: 'Marketing factuur', cat: 'Zakelijk', freq: 'Maandelijks', next: '10 april 2026', amount: 242000 },
]

export default function CashflowView() {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 200)
    return () => clearTimeout(timer)
  }, [])

  const maxAmount = Math.max(...CASHFLOW_DATA.map((d) => d.amount))

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        <StatCard
          label="Deze maand"
          value={332052}
          prefix="€ "
          subtitle="10 openstaande betalingen"
          accent="red"
          icon={<Calendar className="w-[15px] h-[15px] text-status-red" />}
          delay={0}
        />
        <StatCard
          label="Volgende maand (voorspeld)"
          value={89050}
          prefix="€ "
          subtitle="Op basis van vaste lasten"
          accent="amber"
          icon={<CalendarDays className="w-[15px] h-[15px] text-status-amber" />}
          delay={80}
        />
        <StatCard
          label="Maandelijks terugkerend"
          value={77425}
          prefix="€ "
          subtitle="Lease + telecom + energie"
          accent="blue"
          icon={<RefreshCw className="w-[15px] h-[15px] text-brand-blue" />}
          delay={160}
        />
      </div>

      {/* 6-month chart */}
      <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden mb-6 animate-fade-up" style={{ animationDelay: '240ms' }}>
        <div className="px-5 py-[18px] border-b border-border">
          <div className="text-[13.5px] font-bold text-navy">6-maands cashflow overzicht</div>
          <div className="text-[12px] text-muted mt-[2px]">Betaald + voorspeld op basis van vaste lasten en openstaande facturen</div>
        </div>
        <div className="px-5 py-5">
          {/* Bars */}
          <div className="flex items-end gap-3 h-[180px]">
            {CASHFLOW_DATA.map((d, i) => {
              const h = Math.round((d.amount / maxAmount) * 160)
              return (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10.5px] font-bold text-muted">
                    {d.amount >= 100000
                      ? `€${(d.amount / 100000).toFixed(1)}k`
                      : formatAmount(d.amount)
                    }
                  </span>
                  <div
                    className="w-full rounded-t-md cursor-pointer hover:opacity-80 transition-all duration-700"
                    style={{
                      height: animate ? `${h}px` : '0px',
                      background: d.predicted ? '#93C5FD' : '#2563EB',
                      transitionDelay: `${i * 60}ms`,
                    }}
                    title={`${d.month}: ${formatAmount(d.amount)}`}
                  />
                </div>
              )
            })}
          </div>

          {/* Labels */}
          <div className="flex justify-between mt-2 px-[2px]">
            {CASHFLOW_DATA.map((d) => (
              <span key={d.month} className="flex-1 text-center text-[11.5px] font-semibold text-muted-light uppercase">
                {d.month}
              </span>
            ))}
          </div>

          {/* Legend */}
          <div className="flex gap-3.5 mt-3.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="w-2 h-2 rounded-[2px] bg-brand-blue" />
              Betaald
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="w-2 h-2 rounded-[2px] bg-blue-300" />
              Voorspeld
            </div>
          </div>
        </div>
      </div>

      {/* Recurring fixed costs */}
      <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-fade-up" style={{ animationDelay: '320ms' }}>
        <div className="px-5 py-[18px] border-b border-border">
          <div className="text-[13.5px] font-bold text-navy">Terugkerende vaste lasten</div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="bg-bg px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border">Betaler</th>
                <th className="bg-bg px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border">Categorie</th>
                <th className="bg-bg px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border">Frequentie</th>
                <th className="bg-bg px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border">Volgende datum</th>
                <th className="bg-bg px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted border-b border-border pr-5">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {RECURRING.map((r) => (
                <tr key={r.vendor} className="border-b border-border last:border-b-0 hover:bg-[#FAFCFF] transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-[12px] font-extrabold flex-shrink-0 border border-black/[.06]"
                        style={{ background: r.bg, color: r.fg }}
                      >
                        {r.initials}
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-navy">{r.vendor}</div>
                        <div className="text-[11.5px] text-muted">{r.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[11.5px] text-muted font-semibold bg-surface-2 border border-border px-2 py-[3px] rounded-md">
                      {r.cat}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[12.5px] text-muted">{r.freq}</td>
                  <td className="px-4 py-3.5 text-[12.5px] text-muted">{r.next}</td>
                  <td className="px-4 py-3.5 pr-5 text-right">
                    <span className="text-[13.5px] font-extrabold text-navy tracking-tight">{formatAmount(r.amount)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-border">
          {RECURRING.map((r) => (
            <div key={r.vendor} className="flex items-center gap-3 px-4 py-3.5">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-[13px] font-extrabold flex-shrink-0 border border-black/[.06]"
                style={{ background: r.bg, color: r.fg }}
              >
                {r.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-navy truncate">{r.vendor}</span>
                  <span className="text-[13px] font-extrabold text-navy tracking-tight flex-shrink-0">{formatAmount(r.amount)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-muted font-semibold bg-surface-2 border border-border px-1.5 py-[1px] rounded">{r.cat}</span>
                  <span className="text-[11px] text-muted-light">{r.next}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="px-5 py-3.5 border-t border-border bg-bg flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-navy">Totaal maandelijks</span>
          <span className="text-[14px] font-extrabold text-navy tracking-tight">
            {formatAmount(RECURRING.reduce((s, r) => s + r.amount, 0))}
          </span>
        </div>
      </div>
    </>
  )
}
