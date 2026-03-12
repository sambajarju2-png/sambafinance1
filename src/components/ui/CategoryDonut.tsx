'use client'
import { useEffect, useState } from 'react'
interface CategoryItem { name: string; amount: number; color: string }
interface CategoryDonutProps { data: CategoryItem[]; size?: number; strokeWidth?: number }
export default function CategoryDonut({ data, size = 110, strokeWidth = 16 }: CategoryDonutProps) {
  const [animate, setAnimate] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimate(true), 150); return () => clearTimeout(t) }, [])
  const total = data.reduce((s, d) => s + d.amount, 0); const cx = size/2; const cy = size/2; const r = (size-strokeWidth)/2; const circ = 2*Math.PI*r
  let offset = 0
  const segments = data.map(d => { const pct = d.amount/total; const dash = pct*circ; const seg = { ...d, pct: Math.round(pct*100), dash, offset }; offset += dash; return seg })
  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth}/>
        {segments.map((seg, i) => <circle key={seg.name} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeDasharray={`${seg.dash} ${circ}`} strokeDashoffset={-seg.offset} transform={`rotate(-90 ${cx} ${cy})`} className="transition-all duration-700" style={{ opacity: animate ? 1 : 0, transitionDelay: `${i*60}ms` }}/>)}
        <text x={cx} y={cy+3} textAnchor="middle" className="text-[13px] font-extrabold fill-navy" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{data.length}</text>
        <text x={cx} y={cy+16} textAnchor="middle" className="text-[9px] fill-muted-light" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>categorieën</text>
      </svg>
      <div className="flex flex-col gap-2.5 flex-1 min-w-0">
        {segments.map(seg => (
          <div key={seg.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: seg.color }}/>
            <span className="text-[12.5px] text-muted flex-1 truncate">{seg.name}</span>
            <div className="w-[80px] h-[5px] bg-border rounded-full overflow-hidden hidden sm:block"><div className="h-full rounded-full transition-all duration-700" style={{ width: animate ? `${seg.pct}%` : '0%', background: seg.color }}/></div>
            <span className="text-[12px] font-bold text-navy w-[30px] text-right">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
