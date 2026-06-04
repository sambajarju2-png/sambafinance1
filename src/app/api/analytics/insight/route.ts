import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { getCategoryLabel } from '@/lib/analytics/categories'
import { callMistralText } from '@/lib/ai/mistral'
import { log } from '@/lib/logger'

export const maxDuration = 30

const euro = (cents: number) => `€${(cents / 100).toFixed(2).replace('.', ',')}`

function normalizeMonth(input: string | null): string | null {
  if (!input) return null
  const m = input.slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(m)) return null
  return `${m}-01`
}

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie')
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            if (!cookieHeader) return []
            return cookieHeader.split(';').map(c => {
              const [name, ...rest] = c.trim().split('=')
              return { name, value: rest.join('=') }
            })
          },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Resolve month: query param, else latest month with data.
    let month = normalizeMonth(req.nextUrl.searchParams.get('month'))
    if (!month) {
      const { data: latest } = await supabase
        .from('analytics_monthly_totals')
        .select('month')
        .eq('user_id', user.id)
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle()
      month = latest?.month || null
    }
    if (!month) {
      return NextResponse.json({ available: false, summary: 'Er is nog niet genoeg data om een inzicht te maken. Koppel je bank of voeg een paar transacties toe.', highlights: [], tip: '' })
    }

    // Totals for this month + previous month (for trend context).
    const { data: totalsRows } = await supabase
      .from('analytics_monthly_totals')
      .select('month, income_cents, expenses_cents, net_cents, debt_payments_cents')
      .eq('user_id', user.id)
      .lte('month', month)
      .order('month', { ascending: false })
      .limit(2)

    const totals = (totalsRows || []).find(t => t.month === month)
    if (!totals) {
      return NextResponse.json({ available: false, summary: 'Er is voor deze maand nog geen data.', highlights: [], tip: '' })
    }
    const prev = (totalsRows || []).find(t => t.month !== month)

    // Category breakdown for this month.
    const { data: cats } = await supabase
      .from('analytics_monthly_categories')
      .select('category, direction, total_cents')
      .eq('user_id', user.id)
      .eq('month', month)
      .neq('category', 'eigen_rekening')

    const expenseCats = (cats || [])
      .filter(c => c.direction === 'out')
      .sort((a, b) => b.total_cents - a.total_cents)
      .slice(0, 6)
    const incomeCats = (cats || [])
      .filter(c => c.direction === 'in')
      .sort((a, b) => b.total_cents - a.total_cents)
      .slice(0, 4)

    // Input hash — only regenerate when the underlying numbers change.
    const hashInput = JSON.stringify({
      i: totals.income_cents, e: totals.expenses_cents, n: totals.net_cents, d: totals.debt_payments_cents,
      ec: expenseCats.map(c => [c.category, c.total_cents]),
      inc: incomeCats.map(c => [c.category, c.total_cents]),
    })
    const inputHash = createHash('sha256').update(hashInput).digest('hex').slice(0, 32)

    const { data: cached } = await supabase
      .from('analytics_insights')
      .select('payload, input_hash')
      .eq('user_id', user.id)
      .eq('month', month)
      .maybeSingle()

    if (cached && cached.input_hash === inputHash) {
      return NextResponse.json({ available: true, cached: true, month, ...(cached.payload as object) })
    }

    // Build the prompt.
    const monthLabel = new Date(`${month}T00:00:00`).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    const expenseList = expenseCats.length
      ? expenseCats.map(c => `- ${getCategoryLabel(c.category)}: ${euro(c.total_cents)}`).join('\n')
      : '- (geen uitgaven geregistreerd)'
    const incomeList = incomeCats.length
      ? incomeCats.map(c => `- ${getCategoryLabel(c.category)}: ${euro(c.total_cents)}`).join('\n')
      : '- (geen inkomsten geregistreerd)'

    let trendLine = ''
    if (prev) {
      const diff = totals.expenses_cents - prev.expenses_cents
      const dir = diff > 0 ? 'meer' : 'minder'
      trendLine = `\nVergeleken met de maand ervoor gaf je ${euro(Math.abs(diff))} ${dir} uit.`
    }

    const prompt = `Je bent de vriendelijke financiële assistent in de PayWatch-app. Schrijf een kort inzicht over de maand ${monthLabel} voor iemand die zijn huishoudgeld bijhoudt.

Gegevens (euro):
- Inkomsten: ${euro(totals.income_cents)}
- Uitgaven: ${euro(totals.expenses_cents)}
- Saldo over: ${euro(totals.net_cents)} (positief = overgehouden, negatief = tekort)
- Schuldbetalingen deze maand: ${euro(totals.debt_payments_cents)}
Grootste uitgaven:
${expenseList}
Inkomsten uit:
${incomeList}${trendLine}

Schrijf in het Nederlands op B1-niveau. Gebruik 'je' en 'jij', nooit 'u'. Geen moeilijke woorden, geen jargon, geen koppeltekens. Wees bemoedigend en concreet, niet belerend of negatief. Noem echte bedragen uit de gegevens. Verzin nooit gegevens die er niet staan. Als er een categorie "Overig" groot is, mag je voorstellen die transacties te controleren.

Antwoord ALLEEN met geldige JSON, exact dit formaat:
{
  "summary": "2 tot 3 korte zinnen die de maand samenvatten",
  "highlights": [{"label": "korte titel", "detail": "1 zin met een concreet bedrag"}],
  "tip": "1 concrete, haalbare tip voor volgende maand"
}
De array "highlights" bevat 1 tot 3 items.`

    let payload: { summary: string; highlights: Array<{ label: string; detail: string }>; tip: string }
    try {
      const raw = await callMistralText(prompt, user.id, 'analytics_insight')
      const summary = typeof raw.summary === 'string' ? raw.summary : ''
      if (!summary) throw new Error('no summary in model output')
      const highlights = Array.isArray(raw.highlights)
        ? (raw.highlights as unknown[])
            .filter(h => h && typeof h === 'object')
            .map(h => ({
              label: String((h as Record<string, unknown>).label || '').slice(0, 60),
              detail: String((h as Record<string, unknown>).detail || '').slice(0, 200),
            }))
            .filter(h => h.label || h.detail)
            .slice(0, 3)
        : []
      payload = { summary: summary.slice(0, 600), highlights, tip: typeof raw.tip === 'string' ? raw.tip.slice(0, 280) : '' }
    } catch (e) {
      log.error('[analytics/insight] generation failed', { error: e instanceof Error ? e.message : 'unknown' })
      return NextResponse.json({ available: false, error: 'insight_failed' }, { status: 200 })
    }

    await supabase
      .from('analytics_insights')
      .upsert({ user_id: user.id, month, payload, input_hash: inputHash, generated_at: new Date().toISOString() }, { onConflict: 'user_id,month' })

    return NextResponse.json({ available: true, cached: false, month, ...payload })
  } catch (error) {
    console.error('[analytics/insight] error:', error)
    return NextResponse.json({ available: false, error: 'server_error' }, { status: 200 })
  }
}
