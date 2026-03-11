import { NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_USER_ID } from '@/lib/supabase-server'
import { computeBillHash } from '@/lib/hash'

// POST /api/seed — populate the database with mock data
// Run once after deployment to get started
export async function POST() {
  const DEADLINE = Date.now() + 8000
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }

  try {
    const supabase = getSupabaseAdmin()
    const userId = DEMO_USER_ID

    guard()

    // Check if data already exists
    const { count } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (count && count > 0) {
      return NextResponse.json({ message: `Already seeded (${count} bills exist)`, count })
    }

    guard()

    // Mock bills matching the prototype
    const mockBills = [
      { vendor: 'Flanderijn / Evides', amount: 36628, due_date: '2026-03-15', received_date: '2026-03-01', category: 'Incasso', assigned_to: 'mine' as const, status: 'outstanding' as const, reference: 'Dossiernr: 25295267', iban: 'NL74 INGB 0693 5601 34', notes: 'Gebeld op 10 mrt — gevraagd om betalingsregeling' },
      { vendor: 'Anderzorg', amount: 7700, due_date: '2026-03-17', received_date: '2026-03-06', category: 'Zorgverzekering', assigned_to: 'mine' as const, status: 'outstanding' as const, reference: 'Kenmerk: 1000 0102 4008 1676', iban: 'NL87 INGB 0676 416217', notes: null },
      { vendor: 'WorkWings', amount: 242000, due_date: '2026-03-17', received_date: '2026-03-10', category: 'Zakelijk', assigned_to: 'joint' as const, status: 'outstanding' as const, reference: 'INV-6-0018', iban: null, notes: null },
      { vendor: 'Eneco', amount: 21600, due_date: '2026-03-24', received_date: '2026-03-09', category: 'Energie', assigned_to: 'joint' as const, status: 'outstanding' as const, reference: 'Nota: 1145324641', iban: 'NL10 ABNA 0240 120000', notes: null },
      { vendor: 'Hiltermann Lease', amount: 18474, due_date: '2026-04-03', received_date: '2026-03-03', category: 'Lease', assigned_to: 'joint' as const, status: 'outstanding' as const, reference: 'Factuur: 1201382640', iban: null, notes: null },
      { vendor: 'Odido', amount: 5650, due_date: '2026-04-01', received_date: '2026-03-03', category: 'Telecom', assigned_to: 'joint' as const, status: 'outstanding' as const, reference: 'Kenmerk: 2222/1.21899081', iban: null, notes: null },
      { vendor: 'Coolblue', amount: 2999, due_date: '2026-03-17', received_date: '2026-03-05', category: 'Abonnement', assigned_to: 'joint' as const, status: 'outstanding' as const, reference: 'Meerdere pogingen', iban: null, notes: null },
      { vendor: 'KPN', amount: 4500, due_date: '2026-03-28', received_date: '2026-03-08', category: 'Telecom', assigned_to: 'partner' as const, status: 'outstanding' as const, reference: 'KPN herinnering', iban: null, notes: null },
      { vendor: 'Mailmeteor', amount: 301, due_date: '2026-04-01', received_date: '2026-03-07', category: 'Software', assigned_to: 'mine' as const, status: 'outstanding' as const, reference: 'Stripe mislukt', iban: null, notes: null },
      { vendor: 'Seobility', amount: 4999, due_date: '2026-03-22', received_date: '2026-03-06', category: 'Software', assigned_to: 'mine' as const, status: 'outstanding' as const, reference: 'RG-1460395468-0', iban: null, requires_review: true, notes: null },
      // Paid bills
      { vendor: 'Vandebron', amount: 8900, due_date: '2026-02-28', received_date: '2026-02-15', category: 'Energie', assigned_to: 'joint' as const, status: 'settled' as const, reference: 'Factuur VDB-2026-02', iban: null, paid_at: '2026-03-02T10:00:00Z', notes: null },
      { vendor: 'Spotify', amount: 1099, due_date: '2026-03-01', received_date: '2026-02-25', category: 'Software', assigned_to: 'mine' as const, status: 'settled' as const, reference: 'Spotify Premium', iban: null, paid_at: '2026-03-01T08:30:00Z', notes: null },
    ]

    const billsToInsert = []

    for (const mock of mockBills) {
      guard()
      const hash = await computeBillHash(mock.vendor, mock.amount, mock.reference)
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)

      billsToInsert.push({
        id,
        user_id: userId,
        assigned_to: mock.assigned_to,
        vendor: mock.vendor,
        amount: mock.amount,
        currency: 'EUR',
        iban: mock.iban,
        reference: mock.reference,
        due_date: mock.due_date,
        received_date: mock.received_date,
        paid_at: (mock as Record<string, unknown>).paid_at || null,
        category: mock.category,
        status: mock.status,
        source: 'manual',
        gmail_message_id: null,
        hash,
        requires_review: (mock as Record<string, unknown>).requires_review || false,
        notes: mock.notes,
        proof_of_payment: null,
      })
    }

    guard()

    const { data, error } = await supabase
      .from('bills')
      .insert(billsToInsert)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `Seeded ${data.length} bills`,
      count: data.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'TIMEOUT_ABORT' }, { status: 408 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
