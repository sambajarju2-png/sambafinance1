import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAuthUserId } from '@/lib/supabase-server'
import { decrypt, encrypt } from '@/lib/crypto'
import { computeBillHash, validateIBAN } from '@/lib/hash'

const MAX_EMAILS_INITIAL = 300  // First scan: comprehensive inbox scan
const MAX_EMAILS_DAILY = 100    // Daily scans: recent emails only
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

// POST /api/gmail/scan — scan Gmail for invoices
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 8000
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT') }

  try {
    const userId = await getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()

    guard()

    // Get user's Anthropic API key (personal key, or fall back to env var)
    const { data: settings } = await supabase
      .from('user_settings')
      .select('anthropic_api_key')
      .eq('user_id', userId)
      .single()

    const apiKey = settings?.anthropic_api_key || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Geen API key ingesteld. Voeg je Anthropic API key toe via Instellingen → Sync & AI.' }, { status: 400 })
    }

    guard()

    // Get Gmail account for this user
    const { data: account, error: accErr } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (accErr || !account) {
      return NextResponse.json({ error: 'No Gmail account connected' }, { status: 400 })
    }

    guard()

    // Decrypt access token and check if expired
    let accessToken = await decrypt(account.access_token)
    if (Date.now() > account.expires_at) {
      // Refresh the token
      const refreshToken = await decrypt(account.refresh_token)
      const refreshed = await refreshGmailToken(refreshToken)
      if (!refreshed) {
        return NextResponse.json({ error: 'Gmail token expired — reconnect your account' }, { status: 401 })
      }
      accessToken = refreshed.access_token

      // Store the new tokens
      await supabase
        .from('gmail_accounts')
        .update({
          access_token: await encrypt(refreshed.access_token),
          expires_at: Date.now() + (refreshed.expires_in * 1000),
        })
        .eq('user_id', userId)
        .eq('email', account.email)
    }

    guard()

    // Get already-processed message IDs to skip
    const { data: processed } = await supabase
      .from('scan_processed')
      .select('gmail_message_id')
      .eq('user_id', userId)

    const processedIds = new Set((processed || []).map((p: { gmail_message_id: string }) => p.gmail_message_id))

    // Determine if this is the first scan (no processed emails yet)
    const isFirstScan = processedIds.size === 0
    const maxEmails = isFirstScan ? MAX_EMAILS_INITIAL : MAX_EMAILS_DAILY
    
    // For first scan: search older emails. For daily: only recent
    const searchQuery = isFirstScan 
      ? 'has:attachment filename:pdf newer_than:90d'  // First scan: last 90 days
      : 'has:attachment filename:pdf newer_than:7d'    // Daily: last 7 days

    guard()

    // Search for emails with PDF attachments
    const searchRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxEmails}&q=${encodeURIComponent(searchQuery)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!searchRes.ok) {
      return NextResponse.json({ error: 'Gmail API error' }, { status: 502 })
    }

    const searchData = await searchRes.json()
    const messages = (searchData.messages || []) as { id: string }[]

    // Filter out already processed
    const toProcess = messages.filter((m) => !processedIds.has(m.id)).slice(0, maxEmails)

    if (toProcess.length === 0) {
      return NextResponse.json({ message: 'No new invoices found', created: 0, scanned: 0 })
    }

    guard()

    const results: { vendor: string; amount: number; status: string }[] = []

    // Process each message (one at a time to stay under timeout)
    for (const msg of toProcess) {
      if (Date.now() > DEADLINE - 2000) break // Stop 2s before deadline

      try {
        // Fetch the full message
        const msgRes = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!msgRes.ok) continue
        const msgData = await msgRes.json()

        // Find PDF attachments
        const parts = msgData.payload?.parts || []
        const pdfPart = parts.find(
          (p: { mimeType: string; filename: string }) =>
            p.mimeType === 'application/pdf' && p.filename
        )

        if (!pdfPart?.body?.attachmentId) {
          // Mark as processed even if no PDF (so we don't re-scan)
          await markProcessed(supabase, userId, msg.id)
          continue
        }

        // Fetch the PDF attachment
        const attachRes = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${pdfPart.body.attachmentId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!attachRes.ok) continue
        const attachData = await attachRes.json()
        const pdfBase64 = attachData.data // URL-safe base64 from Gmail

        guard()

        // Send to Claude Haiku for extraction
        const extraction = await extractInvoiceWithHaiku(pdfBase64, apiKey)

        if (extraction && extraction.vendor && extraction.amount_cents) {
          // Validate IBAN
          let iban = extraction.iban || null
          let requiresReview = false
          if (iban && !validateIBAN(iban)) {
            iban = null
            requiresReview = true
          }

          // Dedup check
          const hash = await computeBillHash(
            extraction.vendor,
            extraction.amount_cents,
            extraction.reference
          )

          const { data: existing } = await supabase
            .from('bills')
            .select('id')
            .eq('user_id', userId)
            .eq('hash', hash)
            .limit(1)
            .single()

          if (!existing) {
            // Create the bill with all extracted data
            const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
            await supabase.from('bills').insert({
              id,
              user_id: userId,
              assigned_to: 'mine',
              vendor: extraction.vendor,
              amount: extraction.amount_cents,
              currency: extraction.currency || 'EUR',
              iban,
              reference: extraction.reference,
              due_date: extraction.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
              received_date: new Date().toISOString().split('T')[0],
              category: extraction.category_hint || 'Overig',
              status: requiresReview ? 'review' : 'outstanding',
              source: 'gmail_scan',
              gmail_message_id: msg.id,
              hash,
              requires_review: requiresReview || (extraction.confidence?.amount || 0) < 0.7,
              notes: null,
              // New extracted fields
              payment_url: extraction.payment_url || null,
              vendor_contact: extraction.vendor_contact || null,
              checklist: extraction.checklist?.length ? extraction.checklist : null,
              email_drafts: (extraction.email_draft_full || extraction.email_draft_plan) 
                ? { full: extraction.email_draft_full, plan: extraction.email_draft_plan } 
                : null,
            })

            results.push({ vendor: extraction.vendor, amount: extraction.amount_cents, status: 'created' })
          } else {
            results.push({ vendor: extraction.vendor, amount: extraction.amount_cents, status: 'duplicate' })
          }
        }

        // Mark as processed
        await markProcessed(supabase, userId, msg.id)
      } catch {
        // Skip individual message errors
        continue
      }
    }

    // Update last_scanned
    await supabase
      .from('gmail_accounts')
      .update({ last_scanned: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('email', account.email)

    return NextResponse.json({
      message: `Scanned ${toProcess.length} emails`,
      scanned: toProcess.length,
      created: results.filter((r) => r.status === 'created').length,
      duplicates: results.filter((r) => r.status === 'duplicate').length,
      results,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'TIMEOUT_ABORT' }, { status: 408 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── Helper functions ──

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
  } catch {
    return null
  }
}

interface ExtractedInvoice {
  vendor: string
  amount_cents: number
  currency: string
  iban: string | null
  reference: string | null
  due_date: string | null
  category_hint: string
  is_reminder: boolean
  payment_url: string | null
  vendor_contact: { email?: string; phone?: string; website?: string } | null
  checklist: { text: string; done: boolean; urgent: boolean }[]
  email_draft_full: string | null
  email_draft_plan: string | null
  confidence: { vendor: number; amount: number; due_date: number; iban: number }
}

async function extractInvoiceWithHaiku(pdfBase64: string, userApiKey: string): Promise<ExtractedInvoice | null> {
  try {
    if (!userApiKey) return null

    // Convert Gmail's URL-safe base64 to standard base64
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
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: standardBase64 },
            },
            {
              type: 'text',
              text: `Extract ALL invoice data from this PDF. Be thorough and extract every detail.

Categories: Energie, Telecom, Verzekering, Lease, Abonnement, Huur, Belasting, Overig

Extract:
1. Vendor name, amount (in euro cents as integer), IBAN, reference/invoice number, due date
2. Payment URL/link if present (look for "betaal via", "pay at", URLs with payment in them)
3. Contact info: email, phone, website
4. Generate a checklist of 2-4 action items for this bill (e.g. "Check IBAN", "Verify amount", "Pay before deadline")
5. Generate two email drafts in Dutch: one for full payment, one requesting a payment plan

If this is a payment reminder (not a new charge), set is_reminder to true.

Respond ONLY with valid JSON. No markdown. No explanation.

{
  "vendor": "string",
  "amount_cents": integer,
  "currency": "EUR",
  "iban": "string or null",
  "reference": "string or null",
  "due_date": "YYYY-MM-DD or null",
  "category_hint": "one of: Energie, Telecom, Verzekering, Lease, Abonnement, Huur, Belasting, Overig",
  "is_reminder": boolean,
  "payment_url": "URL string or null",
  "vendor_contact": { "email": "string or undefined", "phone": "string or undefined", "website": "string or undefined" },
  "checklist": [{ "text": "string", "done": false, "urgent": boolean }],
  "email_draft_full": "Dutch email for confirming full payment (or null)",
  "email_draft_plan": "Dutch email requesting payment arrangement (or null)",
  "confidence": { "vendor": 0-1, "amount": 0-1, "due_date": 0-1, "iban": 0-1 }
}`,
            },
          ],
        }],
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const text = data.content?.[0]?.text || ''

    // Parse JSON — strip any markdown fences
    const clean = text.replace(/```json\s*|```\s*/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}
