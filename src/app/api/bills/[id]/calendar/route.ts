import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/bills/[id]/calendar — download .ics file for a bill deadline
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Accept token from either Authorization header or query param (for direct downloads)
    let userId = await getAuthUserId(req)
    if (!userId) {
      const url = new URL(req.url)
      const token = url.searchParams.get('token')
      if (token) {
        const supabaseCheck = getSupabaseAdmin()
        const { data: { user } } = await supabaseCheck.auth.getUser(token)
        userId = user?.id ?? null
      }
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: bill, error } = await supabase
      .from('bills')
      .select('vendor, amount, due_date, reference, category')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single()

    if (error || !bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    if (!bill.due_date) return NextResponse.json({ error: 'No due date set' }, { status: 400 })

    const dueDate = new Date(bill.due_date)
    const dtStart = formatICSDate(dueDate)
    // All-day event: DTEND is next day
    const nextDay = new Date(dueDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const dtEnd = formatICSDate(nextDay)
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

    const amountStr = bill.amount
      ? `€${(bill.amount / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`
      : 'bedrag onbekend'

    const summary = `Betaling: ${bill.vendor} (${amountStr})`
    const description = [
      `Categorie: ${bill.category}`,
      bill.reference ? `Kenmerk: ${bill.reference}` : null,
      `Bedrag: ${amountStr}`,
      `Via PayWatch`,
    ].filter(Boolean).join('\\n')

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PayWatch//NL',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `DTSTAMP:${now}`,
      `UID:paywatch-${params.id}@paywatch.app`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Morgen deadline: ${bill.vendor}`,
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-P3D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Deadline over 3 dagen: ${bill.vendor}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="paywatch-${bill.vendor.replace(/[^a-zA-Z0-9]/g, '-')}.ics"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function formatICSDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}
