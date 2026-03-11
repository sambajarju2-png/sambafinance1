import type { DbBill } from '@/lib/types'
import type { Urgency } from '@/lib/mock-data'

// Avatar color pairs based on category
const CATEGORY_COLORS: Record<string, [string, string]> = {
  'Incasso':          ['#FEE2E2', '#DC2626'],
  'Zorgverzekering':  ['#EDE9FE', '#7C3AED'],
  'Zakelijk':         ['#DBEAFE', '#1D4ED8'],
  'Energie':          ['#FDF4FF', '#A21CAF'],
  'Lease':            ['#FEF3C7', '#D97706'],
  'Telecom':          ['#F0FDF4', '#059669'],
  'Abonnement':       ['#DBEAFE', '#1D4ED8'],
  'Software':         ['#EDE9FE', '#7C3AED'],
  'Verzekering':      ['#D1FAE5', '#059669'],
  'Huur':             ['#FFF7ED', '#C2410C'],
  'Belasting':        ['#FEF2F2', '#DC2626'],
  'Overig':           ['#F8FAFD', '#64748B'],
}

const DEFAULT_COLORS: [string, string] = ['#F8FAFD', '#64748B']

export interface DisplayBill {
  id: string
  vendor: string
  initials: string
  avatarBg: string
  avatarFg: string
  category: string
  assignedTo: 'mine' | 'partner' | 'joint'
  amount: number | null
  dueDate: string | null
  description: string
  reference: string
  iban: string | null
  urgency: Urgency
  isDuplicate: boolean
  status: DbBill['status']
  paidAt: string | null
  notes: string | null
  requiresReview: boolean
  source: string
  // Keep original for API calls
  _db: DbBill
}

function getInitials(vendor: string): string {
  return vendor
    .split(/[\s\/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function computeUrgency(bill: DbBill): Urgency {
  if (bill.status === 'settled') return 'info'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (bill.due_date) {
    const due = new Date(bill.due_date)
    due.setHours(0, 0, 0, 0)
    const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000)

    if (daysUntil <= 4) return 'critical'
    if (daysUntil <= 14) return 'warn'
  }

  // No due date or far away
  return 'info'
}

export function dbBillToDisplay(bill: DbBill): DisplayBill {
  const [bg, fg] = CATEGORY_COLORS[bill.category] ?? DEFAULT_COLORS

  return {
    id: bill.id,
    vendor: bill.vendor,
    initials: getInitials(bill.vendor),
    avatarBg: bg,
    avatarFg: fg,
    category: bill.category,
    assignedTo: bill.assigned_to,
    amount: bill.amount,
    dueDate: bill.due_date,
    description: bill.reference || bill.category,
    reference: bill.reference || '—',
    iban: bill.iban,
    urgency: computeUrgency(bill),
    isDuplicate: bill.requires_review,
    status: bill.status,
    paidAt: bill.paid_at,
    notes: bill.notes,
    requiresReview: bill.requires_review,
    source: bill.source,
    _db: bill,
  }
}

export function daysUntilDate(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export function formatAmount(cents: number | null): string {
  if (cents === null) return '—'
  return `€\u00A0${(cents / 100).toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
