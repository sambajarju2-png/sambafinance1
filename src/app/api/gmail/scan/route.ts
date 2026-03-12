import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'
import { decrypt, encrypt } from '@/lib/crypto'
import { computeBillHash, validateIBAN } from '@/lib/hash'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const BATCH_SIZE = 5   // PDFs per request (Vercel 10s limit)
const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' }

// POST /api/gmail/scan — progressive batch scanner
// Body: { mode?: 'initial' | 'daily', pageToken?: string }
// Returns: { ...results, nextPageToken?: string, done: boolean }
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 8000
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }

  try {
    const userId = await getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE })

    const supabase = getSupabaseAdmin()
    let body: { mode?: string; pageToken?: string } = {}
    try { body = await req.json() } catch { /* empty body OK */ }

    const mode = body.mode || 'daily'
    const pageToken = body.pageToken || undefined

    guard()

    // Get user's API key
    const { data: settings } = await supabase
      .from('user_settings')
      .select('anthropic_api_key')
      .eq('user_id', userId)
      .single()

    const apiKey = settings?.anthropic_api_key || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Geen API key ingesteld. Voeg je Anthropic API key toe via Instellingen → Sync & AI.' }, { status: 400, headers: NO_CACHE })
    }

    guard()

    // Get Gmail account
    const { data: account, error: accErr } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (accErr || !account) {
      return NextResponse.json({ error: 'Geen Gmail account gekoppeld' }, { status: 400, headers: NO_CACHE })
    }

    guard()

    // Decrypt + refresh token if needed
    let accessToken = await decrypt(account.access_token)
    if (Date.now() > account.expires_at) {
      const refreshToken = await decrypt(account.refresh_token)
      const refreshed = await refreshGmailToken(refreshToken)
      if (!refreshed) {
        return NextResponse.json({ error: 'Gmail token verlopen — koppel opnieuw' }, { status: 401, headers: NO_CACHE })
      }
      accessToken = refreshed.access_token
      await supabase.from('gmail_accounts').update({
        access_token: await encrypt(refreshed.access_token),
        expires_at: Date.now() + (refreshed.expires_in * 1000),
      }).eq('user_id', userId).eq('email', account.email)
    }

    guard()

    // Get processed message IDs
    const { data: processed } = await supabase
      .from('scan_processed')
      .select('gmail_message_id')
      .eq('user_id', userId)

    const processedIds = new Set((processed || []).map((p: { gmail_message_id: string }) => p.gmail_message_id))

    guard()

    // Build Gmail search query based on mode
    const searchQuery = mode === 'initial'
      ? 'has:attachment filename:pdf'                    // All emails with PDFs
      : 'has:attachment filename:pdf newer_than:2d'      // Last 2 days for daily

    const maxResults = mode === 'initial' ? 20 : 10     // Listing batch size

    let searchUrl = `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(searchQuery)}`
    if (pageToken) searchUrl += `&pageToken=${pageToken}`

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!searchRes.ok) {
      return NextResponse.json({ error: 'Gmail API fout' }, { status: 502, headers: NO_CACHE })
    }

    const searchData = await searchRes.json()
    const messages = (searchData.messages || []) as { id: string }[]
    const nextPageToken = searchData.nextPageToken || null

    // Filter already processed
    const toProcess = messages.filter((m) => !processedIds.has(m.id)).slice(0, BATCH_SIZE)

    if (toProcess.length === 0 && !nextPageToken) {
      // Update scan metadata
      await supabase.from('gmail_accounts').update({
        last_scanned: new Date().toISOString(),
        full_scan_complete: mode === 'initial' ? true : account.full_scan_complete,
      }).eq('user_id', userId).eq('email', account.email)

      return NextResponse.json({
        message: 'Scan compleet — geen nieuwe facturen',
        scanned: 0, created: 0, duplicates: 0, done: true,
      }, { headers: NO_CACHE })
    }

    // If all messages in this batch were already processed but there's more pages
    if (toProcess.length === 0 && nextPageToken) {
      return NextResponse.json({
        message: 'Batch verwerkt, meer paginas beschikbaar',
        scanned: 0, created: 0, duplicates: 0, done: false,
        nextPageToken,
      }, { headers: NO_CACHE })
    }

    guard()

    const results: { vendor: string; amount: number; status: string }[] = []

    for (const msg of toProcess) {
      if (Date.now() > DEADLINE - 2000) break

      try {
        const msgRes = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!msgRes.ok) { await markProcessed(supabase, userId, msg.id); continue }
        const msgData = await msgRes.json()

        // Extract email subject and sender
        const headers = msgData.payload?.headers || []
        const subject = headers.find((h: { name: string }) => h.name === 'Subject')?.value || ''
        const from = headers.find((h: { name: string }) => h.name === 'From')?.value || ''

        // Find PDF attachments
        const parts = msgData.payload?.parts || []
        const pdfPart = parts.find(
          (p: { mimeType: string; filename: string }) => p.mimeType === 'application/pdf' && p.filename
        )

        if (!pdfPart?.body?.attachmentId) {
          await markProcessed(supabase, userId, msg.id)
          continue
        }

        const attachRes = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${pdfPart.body.attachmentId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!attachRes.ok) { await markProcessed(supabase, userId, msg.id); continue }
        const attachData = await attachRes.json()
        const pdfBase64 = attachData.data

        guard()

        const extraction = await extractInvoiceWithHaiku(pdfBase64, apiKey)

        if (extraction && extraction.vendor && extraction.amount_cents) {
          let iban = extraction.iban || null
          let requiresReview = false
          if (iban && !validateIBAN(iban)) { iban = null; requiresReview = true }

          const hash = await computeBillHash(extraction.vendor, extraction.amount_cents, extraction.reference)

          const { data: existing } = await supabase
            .from('bills')
            .select('id')
            .eq('user_id', userId)
            .eq('hash', hash)
            .limit(1)
            .single()

          if (!existing) {
            const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
            await supabase.from('bills').insert({
              id, user_id: userId, assigned_to: 'mine',
              vendor: extraction.vendor, amount: extraction.amount_cents,
              currency: extraction.currency || 'EUR', iban,
              reference: extraction.reference,
              due_date: extraction.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
              received_date: new Date().toISOString().split('T')[0],
              category: extraction.category_hint || 'Overig',
              status: requiresReview ? 'review' : 'outstanding',
              source: 'gmail_scan', gmail_message_id: msg.id, hash,
              requires_review: requiresReview || (extraction.confidence?.amount || 0) < 0.7,
              notes: null,
              vendor_contact: extraction.vendor_contact || null,
              payment_url: extraction.payment_url || null,
              original_email_subject: subject,
              original_email_from: from,
              checklist: [
                { text: `Betaal ${extraction.vendor} vóór deadline`, done: false, urgent: true },
                { text: 'Controleer bedrag en kenmerk', done: false, urgent: false },
                { text: 'Bewaar betaalbevestiging', done: false, urgent: false },
              ],
            })
            results.push({ vendor: extraction.vendor, amount: extraction.amount_cents, status: 'created' })
          } else {
            results.push({ vendor: extraction.vendor, amount: extraction.amount_cents, status: 'duplicate' })
          }
        }

        await markProcessed(supabase, userId, msg.id)
      } catch { continue }
    }

    // Update last_scanned
    await supabase.from('gmail_accounts').update({
      last_scanned: new Date().toISOString(),
    }).eq('user_id', userId).eq('email', account.email)

    const done = !nextPageToken
    return NextResponse.json({
      message: `${toProcess.length} e-mails verwerkt`,
      scanned: toProcess.length,
      created: results.filter(r => r.status === 'created').length,
      duplicates: results.filter(r => r.status === 'duplicate').length,
      results, done, nextPageToken: nextPageToken || undefined,
    }, { headers: NO_CACHE })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') return NextResponse.json({ error: 'TIMEOUT_ABORT' }, { status: 408, headers: NO_CACHE })
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE })
  }
}

// ── Helpers ──

async function markProcessed(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string, messageId: string) {
  await supabase.from('scan_processed').upsert(
    { user_id: userId, gmail_message_id: messageId },
    { onConflict: 'user_id,gmail_message_id' }
  )
}

async function refreshGmailToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function extractInvoiceWithHaiku(pdfBase64: string, userApiKey: string): Promise<{
  vendor: string; amount_cents: number; currency: string; iban: string | null
  reference: string | null; due_date: string | null; category_hint: string
  is_reminder: boolean; payment_url: string | null
  vendor_contact: { email?: string; phone?: string; website?: string } | null
  confidence: { vendor: number; amount: number; due_date: number; iban: number }
} | null> {
  try {
    if (!userApiKey) return null
    const standardBase64 = pdfBase64.replace(/-/g, '+').replace(/_/g, '/')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': userApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: standardBase64 } },
            { type: 'text', text: `Extract invoice data from this PDF. Return vendor name, amount in euro cents (integer), IBAN, reference number, due date, category, and any contact info or payment URLs found.

Categories: Energie, Telecom, Verzekering, Lease, Abonnement, Huur, Belasting, Overig

If this is a payment reminder (not a new charge), set is_reminder to true.
Also extract: vendor contact email, phone, website if visible. Extract any payment URL/link if present.

Respond ONLY with valid JSON. No markdown. No explanation. Start with { and end with }.
{
  "vendor": "string",
  "amount_cents": integer,
  "currency": "EUR",
  "iban": "string or null",
  "reference": "string or null",
  "due_date": "YYYY-MM-DD or null",
  "category_hint": "one of the categories",
  "is_reminder": boolean,
  "payment_url": "string or null",
  "vendor_contact": { "email": "string or null", "phone": "string or null", "website": "string or null" },
  "confidence": { "vendor": 0-1, "amount": 0-1, "due_date": 0-1, "iban": 0-1 }
}` },
          ],
        }],
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/```json\s*|```\s*/g, '').trim()
    return JSON.parse(clean)
  } catch { return null }
}
