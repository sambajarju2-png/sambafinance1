import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getValidTokens } from '@/lib/gmail/tokens';
import { listMessages, getMessageSnippets, getMessageDetail, findPdfAttachments, fetchAttachmentData } from '@/lib/gmail/api';
import { classifyEmail, extractBillFromEmail } from '@/lib/ai';
import { computeBillHash, generateBillId } from '@/lib/bills-server';
import { extractPdfText } from '@/lib/pdf-extract';

const BATCH_SIZE = 10;
const MAX_EMAILS_FIRST_SCAN = 100;
const MAX_EMAILS_RESCAN = 40;

// ─── KEYWORD PRE-FILTER (Session 5) ────────────────────────────
// Same keyword list used by Outlook scan. Skips obvious non-bills
// BEFORE calling Gemini classification — saves AI cost + time.
const BILL_LANGUAGE_KEYWORDS = [
  // Dutch bill/invoice terms
  'factuur', 'rekening', 'nota', 'invoice', 'betaling', 'payment',
  'te betalen', 'openstaand', 'verschuldigd', 'totaalbedrag',
  // Reminders & escalation
  'herinnering', 'aanmaning', 'reminder', 'sommatie', 'ingebrekestelling',
  'laatste waarschuwing', 'betalingsachterstand',
  // Collection & legal
  'incasso', 'deurwaarder', 'vordering', 'gerechtsdeurwaarder',
  'dagvaarding', 'beslag', 'executie', 'automatische incasso',
  // Payment arrangement
  'betalingsregeling', 'termijnbetaling', 'aflossing', 'schuld',
  // Payment details
  'iban', 'bankrekeningnummer', 'overmaken naar', 'betaalinformatie',
  'vervaldatum', 'uiterlijk betalen', 'due date', 'betaal voor',
  'betalingskenmerk', 'kenmerk', 'factuurnummer', 'dossiernummer',
  // Amount indicators
  'bedrag', 'te voldoen',
  // Common bill sender patterns
  'no-reply', 'noreply', 'billing', 'finance', 'administratie',
  'boekhouding', 'debiteuren',
  // Utilities & services
  'energienota', 'jaarnota', 'maandnota', 'termijnbedrag',
  'zorgverzekering', 'premie', 'polis', 'voorschotbedrag',
  // Government
  'belastingdienst', 'cjib', 'duo', 'toeslagen', 'gemeente',
  'waterschapsbelasting', 'motorrijtuigenbelasting', 'svb', 'uwv', 'cak',
];

/**
 * Load vendor + incasso names from DB for keyword matching.
 * Uses the user-scoped supabase client (these are public reference tables).
 */
async function loadVendorKeywords(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<string[]> {
  try {
    const [vendorResult, incassoResult] = await Promise.all([
      supabase.from('vendor_category_map').select('vendor_pattern'),
      supabase.from('incasso_agencies').select('search_name'),
    ]);

    const vendorNames = (vendorResult.data || [])
      .map((v: { vendor_pattern: string }) => v.vendor_pattern.toLowerCase())
      .filter((n: string) => n.length > 3);

    const incassoNames = (incassoResult.data || [])
      .map((a: { search_name: string }) => a.search_name.toLowerCase())
      .filter((n: string) => n.length > 3);

    console.log(`[Gmail scan] Loaded ${vendorNames.length + incassoNames.length} vendor keywords from DB`);
    return [...vendorNames, ...incassoNames];
  } catch {
    console.warn('[Gmail scan] Failed to load vendor keywords, using language keywords only');
    return [];
  }
}

function mightBeBill(subject: string, sender: string, bodySnippet: string, vendorKeywords: string[]): boolean {
  const combined = `${subject} ${sender} ${bodySnippet}`.toLowerCase();
  if (BILL_LANGUAGE_KEYWORDS.some(keyword => combined.includes(keyword))) return true;
  if (vendorKeywords.some(name => combined.includes(name))) return true;
  return false;
}

/**
 * POST /api/gmail/scan
 *
 * Manual scan triggered by user.
 * First scan: up to 100 emails (inbox only, no promotions).
 * Re-scan: up to 40 emails.
 * Now with PDF attachment extraction for accurate bill data.
 * Session 5: Added keyword pre-filter (same as Outlook pipeline).
 * 
 * Body: { account_id, page_token?, total_processed?, is_first_scan? }
 */
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: NO_CACHE });
  }

  const account_id = body.account_id as string;
  const page_token = (body.page_token as string) || null;
  const total_processed = (body.total_processed as number) || 0;

  if (!account_id) return NextResponse.json({ error: 'account_id required' }, { status: 400, headers: NO_CACHE });

  try {
    guard();
    const supabase = await createServerSupabaseClient();

    // Check if this is first scan + load vendor keywords in parallel
    const [accountResult, vendorKeywords] = await Promise.all([
      supabase
        .from('gmail_accounts')
        .select('full_scan_complete')
        .eq('id', account_id)
        .eq('user_id', userId)
        .single(),
      loadVendorKeywords(supabase),
    ]);

    const isFirstScan = !accountResult.data?.full_scan_complete;
    const maxEmails = isFirstScan ? MAX_EMAILS_FIRST_SCAN : MAX_EMAILS_RESCAN;

    if (total_processed >= maxEmails) {
      return NextResponse.json({
        processed: 0, bills_found: 0, page_token: null,
        total_processed: maxEmails, done: true,
      }, { headers: NO_CACHE });
    }

    // Get tokens
    guard();
    console.log(`[Gmail scan] account=${account_id}, first=${isFirstScan}, processed=${total_processed}`);
    const tokens = await getValidTokens(account_id, userId);
    if (!tokens) {
      return NextResponse.json(
        { error: 'Gmail needs re-authentication', needs_reauth: true },
        { status: 401, headers: NO_CACHE }
      );
    }

    // Fetch messages
    guard();
    const messageList = await listMessages(tokens.accessToken, BATCH_SIZE, page_token);

    if (!messageList.messages || messageList.messages.length === 0) {
      console.log('[Gmail scan] No more messages');
      await supabase.from('gmail_accounts').update({
        last_scanned: new Date().toISOString(),
        full_scan_complete: true,
        scan_cursor: null,
      }).eq('id', account_id).eq('user_id', userId);

      return NextResponse.json({
        processed: 0, bills_found: 0, page_token: null,
        total_processed, done: true,
      }, { headers: NO_CACHE });
    }

    // Get snippets
    guard();
    const messageIds = messageList.messages.map((m) => m.id);
    const snippets = await getMessageSnippets(tokens.accessToken, messageIds);
    console.log(`[Gmail scan] Got ${snippets.length} snippets`);

    let billsFound = 0;
    let skippedByKeyword = 0;

    for (const snippet of snippets) {
      guard();

      // Skip already processed
      const { data: alreadyDone } = await supabase
        .from('scan_processed')
        .select('gmail_message_id')
        .eq('user_id', userId)
        .eq('gmail_message_id', snippet.id)
        .maybeSingle();

      if (alreadyDone) continue;

      // ─── Keyword pre-filter (free, <1ms) ─────────────────────
      // Skip emails that clearly aren't bills before calling Gemini
      if (!mightBeBill(snippet.subject || '', snippet.from || '', snippet.snippet || '', vendorKeywords)) {
        skippedByKeyword++;
        await markProcessed(supabase, userId, snippet.id);
        continue;
      }

      // Classify
      let isBill = false;
      try {
        const classification = await classifyEmail(snippet.subject, snippet.from, snippet.snippet, userId);
        isBill = classification.is_bill && classification.confidence > 0.6;
        console.log(`[Gmail scan] "${snippet.subject?.slice(0, 40)}" → is_bill=${isBill}`);
      } catch (err) {
        console.error(`[Gmail scan] Classification failed for ${snippet.id}:`, err);
        await markProcessed(supabase, userId, snippet.id);
        continue;
      }

      if (isBill) {
        try {
          guard();
          const detail = await getMessageDetail(tokens.accessToken, snippet.id);

          // ── PDF attachment extraction ──
          let pdfText: string | null = null;
          if (detail.hasAttachments && detail.rawPayload) {
            try {
              guard();
              const pdfParts = findPdfAttachments(detail.rawPayload);

              if (pdfParts.length > 0) {
                // Take only the first PDF (usually the bill/invoice)
                const firstPdf = pdfParts[0];
                console.log(`[Gmail scan] Found PDF: ${firstPdf.filename} (${(firstPdf.size / 1024).toFixed(0)}KB)`);

                guard();
                const pdfBuffer = await fetchAttachmentData(
                  tokens.accessToken,
                  snippet.id,
                  firstPdf.attachmentId
                );

                if (pdfBuffer) {
                  pdfText = await extractPdfText(pdfBuffer);
                  if (pdfText) {
                    console.log(`[Gmail scan] Extracted ${pdfText.length} chars from PDF`);
                  }
                }
              }
            } catch (pdfErr) {
              // PDF extraction is best-effort — don't fail the whole email
              console.error(`[Gmail scan] PDF extraction failed for ${snippet.id}:`, pdfErr);
            }
          }

          guard();
          // ✅ extractBillFromEmail(subject, body, pdfText, userId) — now with actual PDF text
          const extracted = await extractBillFromEmail(detail.subject, detail.body, pdfText, userId);

          const hash = computeBillHash(
            extracted.vendor,
            extracted.amount_cents,
            extracted.reference || '',
            extracted.due_date || new Date().toISOString().split('T')[0]
          );

          // Smart dedup: same reference + vendor = same bill (even if amount changed)
          let handled = false;

          if (extracted.reference) {
            const { data: existingByRef } = await supabase
              .from('bills')
              .select('id, amount, hash')
              .eq('user_id', userId)
              .ilike('vendor', extracted.vendor)
              .eq('reference', extracted.reference)
              .neq('status', 'settled')
              .maybeSingle();

            if (existingByRef) {
              if (existingByRef.amount !== extracted.amount_cents) {
                // Same bill, amount changed → update
                await supabase.from('bills').update({
                  amount: extracted.amount_cents,
                  hash,
                  escalation_stage: extracted.escalation_stage || undefined,
                  estimated_extra_costs: extracted.estimated_extra_costs_cents || undefined,
                  updated_at: new Date().toISOString(),
                }).eq('id', existingByRef.id);
                billsFound++;
                console.log(`[Gmail scan] Updated: ${extracted.vendor} (amount changed)`);
              }
              handled = true;
            }
          }

          // Also check by hash
          if (!handled) {
            const { data: existingByHash } = await supabase
              .from('bills')
              .select('id')
              .eq('user_id', userId)
              .eq('hash', hash)
              .maybeSingle();

            if (existingByHash) {
              handled = true; // Exact duplicate
            }
          }

          if (!handled) {
            const billId = generateBillId();
            const { error: insertErr } = await supabase.from('bills').insert({
              id: billId,
              user_id: userId,
              vendor: extracted.vendor,
              amount: extracted.amount_cents,
              currency: extracted.currency || 'EUR',
              iban: extracted.iban,
              reference: extracted.reference,
              due_date: extracted.due_date,
              received_date: new Date().toISOString().split('T')[0],
              category: extracted.category_hint || 'overig',
              status: 'outstanding',
              source: 'gmail_scan',
              gmail_message_id: snippet.id,
              gmail_account_id: account_id,
              hash,
              escalation_stage: extracted.escalation_stage || 'factuur',
              estimated_extra_costs: extracted.estimated_extra_costs_cents || 0,
              original_email_subject: detail.subject,
              original_email_from: detail.from,
              payment_url: extracted.payment_url || null,
              vendor_contact: extracted.vendor_contact || null,
            });
            if (!insertErr) {
              billsFound++;
              console.log(`[Gmail scan] New: ${extracted.vendor} - ${extracted.amount_cents}c${pdfText ? ' (with PDF)' : ''}`);
            } else {
              console.error(`[Gmail scan] Insert error:`, insertErr);
            }
          }
        } catch (err) {
          console.error(`[Gmail scan] Extraction error for ${snippet.id}:`, err);
        }
      }

      await markProcessed(supabase, userId, snippet.id);
    }

    const newTotal = total_processed + snippets.length;
    const shouldStop = newTotal >= maxEmails || !messageList.nextPageToken;

    if (shouldStop) {
      await supabase.from('gmail_accounts').update({
        last_scanned: new Date().toISOString(),
        full_scan_complete: true,
        scan_cursor: null,
      }).eq('id', account_id).eq('user_id', userId);
    }

    console.log(`[Gmail scan] Batch: ${snippets.length} processed, ${skippedByKeyword} skipped by keyword, ${billsFound} bills, total: ${newTotal}/${maxEmails}`);

    return NextResponse.json({
      processed: snippets.length,
      bills_found: billsFound,
      page_token: shouldStop ? null : messageList.nextPageToken,
      total_processed: newTotal,
      max_emails: maxEmails,
      done: shouldStop,
    }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({
        error: 'Batch timeout — resuming',
        timeout: true,
        total_processed,
      }, { status: 200, headers: NO_CACHE });
    }
    console.error('[Gmail scan] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scan failed' },
      { status: 500, headers: NO_CACHE }
    );
  }
}

async function markProcessed(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  messageId: string
) {
  await supabase.from('scan_processed').upsert(
    { user_id: userId, gmail_message_id: messageId },
    { onConflict: 'user_id,gmail_message_id' }
  );
}
