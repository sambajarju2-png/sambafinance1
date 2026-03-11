'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: number
  prefix?: string
  suffix?: string
  subtitle: string
  accent: 'red' | 'amber' | 'blue' | 'green'
  icon: ReactNode
  delay?: number
  isInteger?: boolean
}

const ACCENT_MAP = {
  red: {
    stripe: 'before:bg-gradient-to-r before:from-status-red before:to-red-400',
    iconBg: 'bg-status-red-pale',
    valueColor: 'text-status-red',
  },
  amber: {
    stripe: 'before:bg-gradient-to-r before:from-status-amber before:to-amber-400',
    iconBg: 'bg-status-amber-pale',
    valueColor: 'text-navy',
  },
  blue: {
    stripe: 'before:bg-gradient-to-r before:from-brand-blue before:to-brand-blue-hover',
    iconBg: 'bg-brand-blue-pale',
    valueColor: 'text-navy',
  },
  green: {
    stripe: 'before:bg-gradient-to-r before:from-status-green before:to-emerald-400',
    iconBg: 'bg-status-green-pale',
    valueColor: 'text-navy',
  },
}

export default function StatCard({
  label,
  value,
  prefix = '',
  suffix = '',
  subtitle,
  accent,
  icon,
  delay = 0,
  isInteger = false,
}: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const animated = useRef(false)

  useEffect(() => {
    if (animated.current) return
    animated.current = true

    const start = performance.now()
    const duration = 900

    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplayValue(value * ease)
      if (progress < 1) requestAnimationFrame(step)
      else setDisplayValue(value)
    }

    const timer = setTimeout(() => requestAnimationFrame(step), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  const styles = ACCENT_MAP[accent]

  const formattedValue = isInteger
    ? Math.floor(displayValue).toString()
    : (displayValue / 100).toLocaleString('nl-NL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

  return (
    <div
      ref={ref}
      className={`
        relative bg-surface border border-border rounded-card p-[18px] pr-5 shadow-card
        hover:shadow-card-hover hover:-translate-y-[1px] transition-all duration-200
        overflow-hidden animate-fade-up
        before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-card
        ${styles.stripe}
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Icon */}
      <div className={`absolute right-4 top-4 w-[34px] h-[34px] rounded-lg flex items-center justify-center ${styles.iconBg}`}>
        {icon}
      </div>

      {/* Content */}
      <div className="text-[11px] font-bold uppercase tracking-[.07em] text-muted mb-[7px]">
        {label}
      </div>
      <div className={`text-[24px] font-extrabold tracking-tight leading-none mb-[5px] ${styles.valueColor}`}>
        {prefix}{formattedValue}{suffix}
      </div>
      <div className="text-[11.5px] text-muted-light">
        {subtitle}
      </div>
    </div>
  )
}
