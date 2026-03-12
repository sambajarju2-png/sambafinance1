import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'
import { computeBillHash } from '@/lib/hash'
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 8000; const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }
  try {
    const userId = await getAuthUserId(req); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = getSupabaseAdmin(); guard()
    const { count } = await supabase.from('bills').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    if (count && count > 0) return NextResponse.json({ message: `Already seeded (${count} bills)`, count })
    guard()
    const mockBills = [
      { vendor:'Flanderijn / Evides',amount:36628,due_date:'2026-03-15',received_date:'2026-03-01',category:'Incasso',assigned_to:'mine' as const,status:'outstanding' as const,reference:'Dossiernr: 25295267',iban:'NL74 INGB 0693 5601 34',notes:'Gebeld op 10 mrt — gevraagd om betalingsregeling',
        checklist:[{text:'Factuurspecificatie controleren',done:false,urgent:true},{text:'Keuze: volledig betalen of betalingsregeling',done:false,urgent:true},{text:'Reageren vóór 15 maart',done:false,urgent:true},{text:'Bewaar betaalbevestiging',done:false,urgent:false}],
        email_drafts:{full:'Aan: evides@flanderijn.nl\nBetreft: Betaling – Dossiernummer 25295267\n\nGeachte medewerker,\n\nHierbij bevestig ik betaling van €366,28 vóór 15 maart 2026 via IBAN NL74 INGB 0693 5601 34, o.v.v. dossiernummer 25295267.\n\nMet vriendelijke groet,\nSamba Jarju',plan:'Aan: evides@flanderijn.nl\nBetreft: Betalingsregeling – 25295267\n\nGeachte medewerker,\n\nIk verzoek een regeling in 3 termijnen:\n• €122,09 – vóór 15 maart\n• €122,09 – vóór 15 april\n• €122,10 – vóór 15 mei\n\nMet vriendelijke groet,\nSamba Jarju'},
        vendor_contact:{email:'evides@flanderijn.nl',phone:'088-209 3140',website:'flanderijn.nl'}},
      { vendor:'Anderzorg',amount:7700,due_date:'2026-03-17',received_date:'2026-03-06',category:'Zorgverzekering',assigned_to:'mine' as const,status:'outstanding' as const,reference:'Kenmerk: 1000 0102 4008 1676',iban:'NL87 INGB 0676 416217',notes:null,
        checklist:[{text:'Betaal €77,00 via iDEAL vóór 17 maart',done:false,urgent:true},{text:'Controleer of betalingsregeling actief blijft',done:false,urgent:true}],
        email_drafts:{full:'Aan: Anderzorg Klantenservice\nBetreft: Betaling kenmerk 1000 0102 4008 1676\n\nIk bevestig betaling van €77,00 vóór 17 maart via NL87 INGB 0676 416217.\n\nMet vriendelijke groet,\nSamba Jarju'},
        vendor_contact:{email:'klantenservice@anderzorg.nl',phone:'050-520 8100'}},
      { vendor:'WorkWings',amount:242000,due_date:'2026-03-17',received_date:'2026-03-10',category:'Zakelijk',assigned_to:'joint' as const,status:'outstanding' as const,reference:'INV-6-0018',iban:null,notes:null,
        checklist:[{text:'Betaal €2.420 via Revolut vóór 17 maart',done:false,urgent:true},{text:'Verwerk BTW in boekhouding',done:false,urgent:false}],
        email_drafts:{full:'Betreft: Bevestiging betaling INV-6-0018\n\nHierbij bevestig ik betaling van factuur INV-6-0018 (€2.420,00 incl. BTW) vóór 17 maart via Revolut Business.\n\nSamba Jarju',plan:'Betreft: Uitstelverzoek INV-6-0018\n\nIk verzoek een korte uitstelperiode tot 24 maart voor factuur INV-6-0018 (€2.420,00).\n\nSamba Jarju'},
        vendor_contact:{email:'finance@workwings.nl',website:'workwings.nl'}},
      { vendor:'Eneco',amount:21600,due_date:'2026-03-24',received_date:'2026-03-09',category:'Energie',assigned_to:'joint' as const,status:'outstanding' as const,reference:'Nota: 1145324641',iban:'NL10 ABNA 0240 120000',notes:null,payment_url:'https://www.eneco.nl/mijn-eneco/',
        checklist:[{text:'Betaal €216,00 vóór 24 maart',done:false,urgent:true},{text:'Kenmerk: 7000 0114 5324 6412 vermelden',done:false,urgent:true}],
        email_drafts:{full:'Aan: Eneco Klantenservice\n\nIk bevestig betaling van nota 1145324641 (€216,00) vóór 24 maart, kenmerk: 7000 0114 5324 6412.\n\nSamba Jarju',plan:'Aan: Eneco Klantenservice\n\nIk verzoek een betalingsregeling:\n• €108,00 – vóór 24 maart\n• €108,00 – vóór 24 april\n\nSamba Jarju'},
        vendor_contact:{email:'klantenservice@eneco.nl',phone:'0900-0201',website:'eneco.nl/klantenservice'}},
      { vendor:'Hiltermann Lease',amount:18474,due_date:'2026-04-03',received_date:'2026-03-03',category:'Lease',assigned_to:'joint' as const,status:'outstanding' as const,reference:'Factuur: 1201382640',iban:null,notes:null,
        checklist:[{text:'Betaal €184,74 handmatig overmaken',done:false,urgent:true},{text:'Herstel automatische incasso bij bank',done:false,urgent:false}],
        email_drafts:{full:'Aan: debiteuren@hiltermannlease.nl\n\nIk bevestig handmatige betaling van €184,74 voor factuur 1201382640.\n\nSamba Jarju'},
        vendor_contact:{email:'debiteuren@hiltermannlease.nl',website:'hiltermannlease.nl'}},
      { vendor:'Odido',amount:5650,due_date:'2026-04-01',received_date:'2026-03-03',category:'Telecom',assigned_to:'joint' as const,status:'outstanding' as const,reference:'Kenmerk: 2222/1.21899081',iban:null,notes:null,payment_url:'https://www.odido.nl/mijn-odido',
        checklist:[{text:'Betaal via Mijn Odido',done:false,urgent:false}],vendor_contact:{phone:'0800-0092',website:'odido.nl'}},
      { vendor:'Coolblue',amount:2999,due_date:'2026-03-17',received_date:'2026-03-05',category:'Abonnement',assigned_to:'joint' as const,status:'outstanding' as const,reference:'Meerdere pogingen',iban:null,notes:null,payment_url:'https://www.coolblue.nl/mijn-coolblue',
        checklist:[{text:'Log in op Coolblue, controleer bedrag',done:false,urgent:true},{text:'Werk betaalgegevens bij',done:false,urgent:true}],vendor_contact:{phone:'010-799 8979',website:'coolblue.nl'}},
      { vendor:'KPN',amount:4500,due_date:'2026-03-28',received_date:'2026-03-08',category:'Telecom',assigned_to:'partner' as const,status:'outstanding' as const,reference:'KPN herinnering',iban:null,notes:null,payment_url:'https://www.kpn.com/mijn-kpn',
        checklist:[{text:'Log in op Mijn KPN voor bedrag',done:false,urgent:true}],vendor_contact:{phone:'0800-0402',website:'kpn.com'}},
      { vendor:'Mailmeteor',amount:301,due_date:'2026-04-01',received_date:'2026-03-07',category:'Software',assigned_to:'mine' as const,status:'outstanding' as const,reference:'Stripe mislukt',iban:null,notes:null,payment_url:'https://dashboard.mailmeteor.com/billing',
        checklist:[{text:'Update creditcard op mailmeteor.com',done:false,urgent:false}],vendor_contact:{website:'mailmeteor.com'}},
      { vendor:'Seobility',amount:4999,due_date:'2026-03-22',received_date:'2026-03-06',category:'Software',assigned_to:'mine' as const,status:'outstanding' as const,reference:'RG-1460395468-0',iban:null,requires_review:true,notes:null,
        checklist:[{text:'Controleer bedrag op seobility.net',done:false,urgent:false}],
        email_drafts:{full:'Aan: billing@seobility.net\nBetreft: Payment invoice RG-1460395468-0\n\nPayment will be arranged shortly.\n\nSamba Jarju'},
        vendor_contact:{email:'billing@seobility.net',website:'seobility.net'}},
      { vendor:'Vandebron',amount:8900,due_date:'2026-02-28',received_date:'2026-02-15',category:'Energie',assigned_to:'joint' as const,status:'settled' as const,reference:'Factuur VDB-2026-02',iban:null,paid_at:'2026-03-02T10:00:00Z',notes:null,checklist:[],email_drafts:{},vendor_contact:{}},
      { vendor:'Spotify',amount:1099,due_date:'2026-03-01',received_date:'2026-02-25',category:'Software',assigned_to:'mine' as const,status:'settled' as const,reference:'Spotify Premium',iban:null,paid_at:'2026-03-01T08:30:00Z',notes:null,checklist:[],email_drafts:{},vendor_contact:{}},
    ]
    const billsToInsert = []
    for (const mock of mockBills) {
      guard()
      const hash = await computeBillHash(mock.vendor, mock.amount, mock.reference)
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      billsToInsert.push({
        id, user_id: userId, assigned_to: mock.assigned_to, vendor: mock.vendor, amount: mock.amount,
        currency: 'EUR', iban: mock.iban || null, reference: mock.reference, due_date: mock.due_date,
        received_date: mock.received_date, paid_at: (mock as Record<string, unknown>).paid_at || null,
        category: mock.category, status: mock.status, source: 'manual', gmail_message_id: null, hash,
        requires_review: (mock as Record<string, unknown>).requires_review || false, notes: mock.notes,
        proof_of_payment: null, checklist: mock.checklist || [], email_drafts: mock.email_drafts || {},
        vendor_contact: mock.vendor_contact || {}, payment_url: (mock as Record<string, unknown>).payment_url || null,
      })
    }
    guard()
    const { data, error } = await supabase.from('bills').insert(billsToInsert).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: `Seeded ${data.length} bills`, count: data.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') return NextResponse.json({ error: 'TIMEOUT_ABORT' }, { status: 408 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
