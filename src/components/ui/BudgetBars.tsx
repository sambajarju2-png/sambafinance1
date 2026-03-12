'use client'
import { useEffect, useState } from 'react'
import { formatAmount } from '@/lib/mock-data'
interface BudgetItem { name: string; amount: number; budget: number; color: string }
export default function BudgetBars({ data }: { data: BudgetItem[] }) {
  const [animate, setAnimate] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimate(true), 100); return () => clearTimeout(t) }, [])
  return (
    <div className="space-y-3.5">
      {data.map(item => { const pct = Math.min(Math.round((item.amount/item.budget)*100),100); const over = item.amount > item.budget; return (
        <div key={item.name}>
          <div className="flex items-center justify-between mb-[5px]">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-navy"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:item.color}}/>{item.name}</div>
            <div className="text-[12px] text-muted"><span className="font-bold text-navy">{formatAmount(item.amount)}</span> / {formatAmount(item.budget)}</div>
          </div>
          <div className="h-[7px] bg-border rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-1000 ease-out" style={{width:animate?`${pct}%`:'0%',background:over?'#DC2626':item.color}}/></div>
        </div>
      )})}
    </div>
  )
}
