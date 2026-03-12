'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
interface StatCardProps { label: string; value: number; prefix?: string; suffix?: string; subtitle: string; accent: 'red'|'amber'|'blue'|'green'; icon: ReactNode; delay?: number; isInteger?: boolean }
const A = {
  red: { stripe: 'before:bg-gradient-to-r before:from-status-red before:to-red-400', iconBg: 'bg-status-red-pale', valueColor: 'text-status-red' },
  amber: { stripe: 'before:bg-gradient-to-r before:from-status-amber before:to-amber-400', iconBg: 'bg-status-amber-pale', valueColor: 'text-navy' },
  blue: { stripe: 'before:bg-gradient-to-r before:from-brand-blue before:to-brand-blue-hover', iconBg: 'bg-brand-blue-pale', valueColor: 'text-navy' },
  green: { stripe: 'before:bg-gradient-to-r before:from-status-green before:to-emerald-400', iconBg: 'bg-status-green-pale', valueColor: 'text-navy' },
}
export default function StatCard({ label, value, prefix='', suffix='', subtitle, accent, icon, delay=0, isInteger=false }: StatCardProps) {
  const [dv, setDv] = useState(0); const anim = useRef(false)
  useEffect(() => {
    if (anim.current) return; anim.current = true
    const start = performance.now()
    function step(now: number) { const p = Math.min((now-start)/900,1); const e = 1-Math.pow(1-p,3); setDv(value*e); if(p<1)requestAnimationFrame(step); else setDv(value) }
    const t = setTimeout(() => requestAnimationFrame(step), delay); return () => clearTimeout(t)
  }, [value, delay])
  const s = A[accent]
  const fv = isInteger ? Math.floor(dv).toString() : (dv/100).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})
  return (
    <div className={`relative bg-surface border border-border rounded-card p-[18px] pr-5 shadow-card hover:shadow-card-hover hover:-translate-y-[1px] transition-all duration-200 overflow-hidden animate-fade-up before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-card ${s.stripe}`} style={{animationDelay:`${delay}ms`}}>
      <div className={`absolute right-4 top-4 w-[34px] h-[34px] rounded-lg flex items-center justify-center ${s.iconBg}`}>{icon}</div>
      <div className="text-[11px] font-bold uppercase tracking-[.07em] text-muted mb-[7px]">{label}</div>
      <div className={`text-[24px] font-extrabold tracking-tight leading-none mb-[5px] ${s.valueColor}`}>{prefix}{fv}{suffix}</div>
      <div className="text-[11.5px] text-muted-light">{subtitle}</div>
    </div>
  )
}
