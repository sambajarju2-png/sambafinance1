// Mock data for the static dashboard — mirrors the HTML prototype
// All amounts in CENTS as per spec. Display with formatAmount()

export type BillCategory =
  | 'Energie'
  | 'Telecom'
  | 'Verzekering'
  | 'Lease'
  | 'Abonnement'
  | 'Huur'
  | 'Belasting'
  | 'Overig'
  | 'Incasso'
  | 'Zakelijk'
  | 'Zorgverzekering'
  | 'Software'

export type BillStatus = 'outstanding' | 'action' | 'settled' | 'failed' | 'review'
export type Urgency = 'critical' | 'warn' | 'info'
export type AssignedTo = 'mine' | 'partner' | 'joint'

export interface MockBill {
  id: string
  vendor: string
  initials: string
  avatarBg: string
  avatarFg: string
  category: string
  assignedTo: AssignedTo
  amount: number | null       // cents, null if unknown
  dueDate: string | null      // YYYY-MM-DD
  description: string
  reference: string
  iban: string | null
  urgency: Urgency
  isDuplicate: boolean
  status: BillStatus
  paidAt: string | null
}

export const MOCK_BILLS: MockBill[] = [
  {
    id: '1',
    vendor: 'Flanderijn / Evides',
    initials: 'FE',
    avatarBg: '#FEE2E2',
    avatarFg: '#DC2626',
    category: 'Incasso',
    assignedTo: 'mine',
    amount: 36628,
    dueDate: '2026-03-15',
    description: 'Incasso dreiging waterrekening',
    reference: 'Dossiernr: 25295267',
    iban: 'NL74 INGB 0693 5601 34',
    urgency: 'critical',
    isDuplicate: false,
    status: 'outstanding',
    paidAt: null,
  },
  {
    id: '2',
    vendor: 'Anderzorg',
    initials: 'AZ',
    avatarBg: '#EDE9FE',
    avatarFg: '#7C3AED',
    category: 'Zorgverzekering',
    assignedTo: 'mine',
    amount: 7700,
    dueDate: '2026-03-17',
    description: 'Automatische incasso mislukt',
    reference: 'Kenmerk: 1000 0102 4008 1676',
    iban: 'NL87 INGB 0676 416217',
    urgency: 'critical',
    isDuplicate: false,
    status: 'outstanding',
    paidAt: null,
  },
  {
    id: '3',
    vendor: 'WorkWings',
    initials: 'WW',
    avatarBg: '#DBEAFE',
    avatarFg: '#1D4ED8',
    category: 'Zakelijk',
    assignedTo: 'joint',
    amount: 242000,
    dueDate: '2026-03-17',
    description: 'Maandelijkse marketing factuur INV-6-0018',
    reference: 'INV-6-0018 · Revolut',
    iban: null,
    urgency: 'warn',
    isDuplicate: false,
    status: 'outstanding',
    paidAt: null,
  },
  {
    id: '4',
    vendor: 'Eneco',
    initials: 'EN',
    avatarBg: '#FDF4FF',
    avatarFg: '#A21CAF',
    category: 'Energie',
    assignedTo: 'joint',
    amount: 21600,
    dueDate: '2026-03-24',
    description: 'Betalingsherinnering nota 1145324641',
    reference: 'Nota: 1145324641',
    iban: 'NL10 ABNA 0240 120000',
    urgency: 'warn',
    isDuplicate: false,
    status: 'outstanding',
    paidAt: null,
  },
  {
    id: '5',
    vendor: 'Hiltermann Lease',
    initials: 'HL',
    avatarBg: '#FEF3C7',
    avatarFg: '#D97706',
    category: 'Lease',
    assignedTo: 'joint',
    amount: 18474,
    dueDate: null,
    description: 'Stornering automatische incasso',
    reference: 'Factuur: 1201382640',
    iban: null,
    urgency: 'warn',
    isDuplicate: false,
    status: 'outstanding',
    paidAt: null,
  },
  {
    id: '6',
    vendor: 'Odido',
    initials: 'OD',
    avatarBg: '#F0FDF4',
    avatarFg: '#059669',
    category: 'Telecom',
    assignedTo: 'joint',
    amount: 5650,
    dueDate: '2026-04-01',
    description: 'Maandelijkse factuur mobiel abonnement',
    reference: 'Kenmerk: 2222/1.21899081',
    iban: null,
    urgency: 'info',
    isDuplicate: false,
    status: 'outstanding',
    paidAt: null,
  },
  {
    id: '7',
    vendor: 'Coolblue',
    initials: 'CB',
    avatarBg: '#DBEAFE',
    avatarFg: '#1D4ED8',
    category: 'Abonnement',
    assignedTo: 'joint',
    amount: null,
    dueDate: '2026-03-17',
    description: 'Automatische incasso 3× mislukt',
    reference: 'Meerdere pogingen',
    iban: null,
    urgency: 'info',
    isDuplicate: false,
    status: 'outstanding',
    paidAt: null,
  },
  {
    id: '8',
    vendor: 'KPN',
    initials: 'KP',
    avatarBg: '#F0FDF4',
    avatarFg: '#166534',
    category: 'Telecom',
    assignedTo: 'partner',
    amount: null,
    dueDate: null,
    description: 'Betalingsherinnering (bedrag onbekend)',
    reference: 'KPN starred herinnering',
    iban: null,
    urgency: 'info',
    isDuplicate: false,
    status: 'outstanding',
    paidAt: null,
  },
  {
    id: '9',
    vendor: 'Mailmeteor',
    initials: 'MM',
    avatarBg: '#EDE9FE',
    avatarFg: '#7C3AED',
    category: 'Software',
    assignedTo: 'mine',
    amount: 301,
    dueDate: null,
    description: 'Stripe betaling herhaaldelijk mislukt',
    reference: 'Stripe €3,01/maand',
    iban: null,
    urgency: 'info',
    isDuplicate: false,
    status: 'outstanding',
    paidAt: null,
  },
  {
    id: '10',
    vendor: 'Seobility',
    initials: 'SB',
    avatarBg: '#FFF7ED',
    avatarFg: '#C2410C',
    category: 'Software',
    assignedTo: 'mine',
    amount: null,
    dueDate: '2026-03-22',
    description: 'Eerste betalingsherinnering — duplicaat van eerdere mail',
    reference: 'RG-1460395468-0',
    iban: null,
    urgency: 'info',
    isDuplicate: true,
    status: 'outstanding',
    paidAt: null,
  },
]

export const MOCK_PAID: MockBill[] = [
  {
    id: '101',
    vendor: 'Vandebron',
    initials: 'VB',
    avatarBg: '#D1FAE5',
    avatarFg: '#059669',
    category: 'Energie',
    assignedTo: 'joint',
    amount: 8900,
    dueDate: null,
    description: 'Maandelijkse energiefactuur voldaan',
    reference: 'Factuur VDB-2026-02',
    iban: null,
    urgency: 'info',
    isDuplicate: false,
    status: 'settled',
    paidAt: '2026-03-02T10:00:00Z',
  },
  {
    id: '102',
    vendor: 'Spotify',
    initials: 'SP',
    avatarBg: '#F0FDF4',
    avatarFg: '#166534',
    category: 'Software',
    assignedTo: 'mine',
    amount: 1099,
    dueDate: null,
    description: 'Maandelijks abonnement',
    reference: 'Spotify Premium',
    iban: null,
    urgency: 'info',
    isDuplicate: false,
    status: 'settled',
    paidAt: '2026-03-01T08:30:00Z',
  },
]

// Category breakdown for charts
export const CATEGORY_DATA = [
  { name: 'Zakelijk', amount: 242000, color: '#2563EB', budget: 250000 },
  { name: 'Incasso', amount: 36628, color: '#DC2626', budget: 40000 },
  { name: 'Energie', amount: 21600, color: '#D97706', budget: 25000 },
  { name: 'Lease', amount: 18474, color: '#7C3AED', budget: 20000 },
  { name: 'Zorgverzekering', amount: 7700, color: '#059669', budget: 10000 },
  { name: 'Telecom', amount: 5650, color: '#0369A1', budget: 8000 },
  { name: 'Software', amount: 602, color: '#94A3B8', budget: 5000 },
]

// Cashflow data for mini chart
export const CASHFLOW_DATA = [
  { month: 'Jan', amount: 124000, predicted: false },
  { month: 'Feb', amount: 98000, predicted: false },
  { month: 'Mrt', amount: 332052, predicted: false },
  { month: 'Apr', amount: 89050, predicted: true },
  { month: 'Mei', amount: 76000, predicted: true },
  { month: 'Jun', amount: 82000, predicted: true },
]

// ── Formatting helpers ──

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

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

// Dashboard stats computed from mock data
export function getStats(bills: MockBill[]) {
  const open = bills.filter((b) => b.status !== 'settled')
  const critical = open.filter((b) => b.urgency === 'critical')
  const warn = open.filter((b) => b.urgency === 'warn')

  const sumCents = (arr: MockBill[]) =>
    arr.reduce((sum, b) => sum + (b.amount ?? 0), 0)

  return {
    criticalAmount: sumCents(critical),
    criticalCount: critical.length,
    warnAmount: sumCents(warn),
    warnCount: warn.length,
    failedCount: open.filter(
      (b) => b.description.toLowerCase().includes('mislukt') || b.description.toLowerCase().includes('stornering')
    ).length,
    totalAmount: sumCents(open),
    totalCount: open.length,
  }
}
