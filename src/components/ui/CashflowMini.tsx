'use client'

import { useEffect, useState } from 'react'
import { formatAmount } from '@/lib/mock-data'

interface CashflowItem {
  month: string
  amount: number  // cents
  predicted: boolean
}

interface CashflowMiniProps {
  data: CashflowItem[]
}

export default function CashflowMini({ data }: CashflowMiniProps) {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 200)
    return () => clearTimeout(timer)
  }, [])

  const maxAmount = Math.max(...data.map((d) => d.amount))

  return (
    <div>
      {/* Month labels */}
      <div className="flex justify-between px-1 mb-1.5">
        {data.map((d) => (
          <span key={d.month} className="text-[10.5px] font-semibold text-muted-light uppercase">
            {d.month}
          </span>
        ))}
      </div>

      {/* Bars */}
      <div className="flex items-end gap-2 h-[100px]">
        {data.map((d, i) => {
          const height = Math.round((d.amount / maxAmount) * 85)
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t transition-all duration-700 cursor-pointer group relative"
                style={{
                  height: animate ? `${height}px` : '0px',
                  background: d.predicted ? '#93C5FD' : '#2563EB',
                  transitionDelay: `${i * 60}ms`,
                }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-navy text-white text-[10px] font-bold px-2 py-1 rounded-[5px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {d.predicted ? 'Voorspeld' : 'Betaald'}: {formatAmount(d.amount)}
                </div>
              </div>
              <span className="text-[9.5px] font-bold text-muted-light">
                {d.amount >= 100000
                  ? `€${(d.amount / 100000).toFixed(1)}k`
                  : formatAmount(d.amount)
                }
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3.5 mt-2 px-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="w-2 h-2 rounded-[2px] bg-brand-blue" />
          Gepland
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="w-2 h-2 rounded-[2px] bg-blue-300" />
          Voorspeld
        </div>
      </div>
    </div>
  )
}
