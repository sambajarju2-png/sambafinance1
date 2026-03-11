'use client'

import type { Urgency } from '@/lib/mock-data'

interface StatusBadgeProps {
  urgency: Urgency | 'paid' | 'duplicate'
}

const BADGE_STYLES: Record<string, { bg: string; text: string; border: string; label: string; dot: boolean }> = {
  critical: {
    bg: 'bg-status-red-pale',
    text: 'text-status-red',
    border: 'border-status-red-mid',
    label: '🚨 Kritiek',
    dot: true,
  },
  warn: {
    bg: 'bg-status-amber-pale',
    text: 'text-status-amber',
    border: 'border-status-amber-mid',
    label: '⚠️ Binnenkort',
    dot: false,
  },
  info: {
    bg: 'bg-brand-blue-pale',
    text: 'text-brand-blue',
    border: 'border-brand-blue-mid',
    label: '🔵 Actie vereist',
    dot: false,
  },
  paid: {
    bg: 'bg-status-green-pale',
    text: 'text-status-green',
    border: 'border-status-green-mid',
    label: '✓ Betaald',
    dot: false,
  },
  duplicate: {
    bg: 'bg-[#FEF3C7]',
    text: 'text-[#92400E]',
    border: 'border-[#FDE68A]',
    label: '⚠ Duplicaat',
    dot: false,
  },
}

export default function StatusBadge({ urgency }: StatusBadgeProps) {
  const style = BADGE_STYLES[urgency] ?? BADGE_STYLES.info
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full
        text-[11px] font-bold whitespace-nowrap border
        ${style.bg} ${style.text} ${style.border}
      `}
    >
      {style.dot && (
        <span className="w-[5px] h-[5px] rounded-full bg-current animate-blink" />
      )}
      {style.label}
    </span>
  )
}
