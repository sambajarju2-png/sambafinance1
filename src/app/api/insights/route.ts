import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' }

// POST /api/insights — generate AI financial insights from current bills
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 8000
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }

  try {
    const userId = await getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE })

    const supabase = getSupabaseAdmin()

    guard()

    // Get user's API key
    const { data: settings } = await supabase
      .from('user_settings')
      .select('anthropic_api_key')
      .eq('user_id', userId)
      .single()

    const apiKey = settings?.anthropic_api_key || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'Geen API key ingesteld. Voeg je Anthropic API key toe via Instellingen → Sync & AI.',
      }, { status: 400, headers: NO_CACHE })
    }

    guard()

    // Fetch all outstanding bills
    const { data: bills, error: billsErr } = await supabase
      .from('bills')
      .select('vendor, amount, due_date, category, status, iban, reference, notes')
      .eq('user_id', userId)
      .neq('status', 'settled')
      .order('due_date', { ascending: true })

    if (billsErr) return NextResponse.json({ error: billsErr.message }, { status: 500, headers: NO_CACHE })
    if (!bills || bills.length === 0) {
      return NextResponse.json({
        insights: [{ type: 'success', title: 'Alles op orde', text: 'Je hebt geen openstaande betalingen. Goed bezig!' }],
      }, { headers: NO_CACHE })
    }

    guard()

    // Build a concise summary for Haiku
    const today = new Date().toISOString().split('T')[0]
    const billSummary = bills.map((b: { vendor: string; amount: number; due_date: string; category: string; status: string }) => ({
      vendor: b.vendor,
      amount_eur: (b.amount / 100).toFixed(2),
      due: b.due_date,
      category: b.category,
      status: b.status,
    }))

    const totalOutstanding = bills.reduce((s: number, b: { amount: number }) => s + b.amount, 0)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 384,
        messages: [{
          role: 'user',
          content: `Je bent een Nederlandse financieel adviseur voor een huishouden. Analyseer deze openstaande rekeningen en geef 3-5 concrete, bruikbare inzichten in het Nederlands.

Vandaag is: ${today}
Totaal openstaand: €${(totalOutstanding / 100).toFixed(2)}

Openstaande rekeningen:
${JSON.stringify(billSummary, null, 0)}

Geef advies over:
1. Welke rekening eerst betalen (prioriteit op basis van urgentie en gevolgen)
2. Besparingsmogelijkheden
3. Risico's (incasso, boetes, afsluitingen)
4. Cashflow advies

Respond ONLY with valid JSON. No markdown. No explanation. Start with { and end with }.
Schema:
{
  "insights": [
    {
      "type": "priority" | "saving" | "risk" | "tip",
      "title": "korte titel (max 8 woorden)",
      "text": "concreet advies (max 2 zinnen)"
    }
  ]
}`,
        }],
      }),
    })

    guard()

    if (!res.ok) {
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 502, headers: NO_CACHE })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/```json\s*|```\s*/g, '').trim()

    try {
      const parsed = JSON.parse(clean)
      return NextResponse.json(parsed, { headers: NO_CACHE })
    } catch {
      return NextResponse.json({
        insights: [{ type: 'tip', title: 'Analyse niet beschikbaar', text: 'Er ging iets mis bij het genereren van inzichten. Probeer het later opnieuw.' }],
      }, { headers: NO_CACHE })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') return NextResponse.json({ error: 'TIMEOUT_ABORT' }, { status: 408, headers: NO_CACHE })
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE })
  }
}
