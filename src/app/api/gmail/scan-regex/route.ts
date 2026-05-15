import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getValidTokens } from '@/lib/gmail/tokens';
import { listMessages, getMessageSnippets, getMessageDetail, findPdfAttachments, fetchAttachmentData } from '@/lib/gmail/api';
import { extractFromText, stripHtml } from '@/lib/regex-extractor';
import { computeBillHash, generateBillId } from '@/lib/bills-server';
import { extractPdfText } from '@/lib/pdf-extract';

const BATCH_SIZE = 10;
const MAX_EMAILS_FIRST_SCAN = 100;
const MAX_EMAILS_RESCAN = 40;

/** Minimum confidence to save a bill (vendor + amount = 0.55) */
const MIN_CONFIDENCE = 0.5;

// ─── KEYWORD PRE-FILTER (replaces Gemini classification) ───
const BILL_LANGUAGE_KEYWORDS = [
  'factuur', 'rekening', 'nota', 'invoice', 'betaling', 'payment',
  'te betalen', 'openstaand', 'verschuldigd', 'totaalbedrag',
  'herinnering', 'aanmaning', 'reminder', 'sommatie', 'ingebrekestelling',
  'laatste waarschuwing', 'betalingsachterstand',
  'incasso', 'deurwaarder', 'vordering', 'gerechtsdeurwaarder',
  'dagvaarding', 'beslag', 'executie', 'automatische incasso',
  'betalingsregeling', 'termijnbetaling', 'aflossing', 'schuld',
  'iban', 'bankrekeningnummer', 'overmaken naar', 'betaalinformatie',
  'vervaldatum', 'uiterlijk betalen', 'due date', 'betaal voor',
  'betalingskenmerk', 'kenmerk', 'factuurnummer', 'dossiernummer',
  'bedrag', 'te voldoen',
  'no-reply', 'noreply', 'billing', 'finance', 'administratie',
  'boekhouding', 'debiteuren',
  'energienota', 'jaarnota', 'maandnota', 'termijnbedrag',
  'zorgverzekering', 'premie', 'polis', 'voorschotbedrag',
  'belastingdienst', 'cjib', 'duo', 'toeslagen', 'gemeente',
  'waterschapsbelasting', 'motorrijtuigenbelasting', 'svb', 'uwv', 'cak',
  'gestorneerd', 'storno', // storno detection
];

async function loadVendorKeywords(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<string[]> {
  try {
    const [vendorResult, incassoResult] = await Promise.all([
      supabase.from('vendor_category_map').select('vendor_pattern'),
      supabase.from('incasso_agencies').select('search_name'),
    ]);
    const vendors = (vendorResult.data || []).map((v: { vendor_pattern: string }) => v.vendor_pattern.toLowerCase()).filter((n: string) => n.length > 3);
    const incasso = (incassoResult.data || []).map((a: { search_name: string }) => a.search_name.toLowerCase()).filter((n: string) => n.length > 3);
    console.log(`[Gmail Regex] Loaded ${vendors.length + incasso.length} vendor keywords`);
    return [...vendors, ...incasso];
  } catch {
    return [];
  }
}

function mightBeBill(subject: string, sender: string, bodySnippet: string, vendorKeywords: string[]): boolean {
  const combined = `${subject} ${sender} ${bodySnippet}`.toLowerCase();
  if (BILL_LANGUAGE_KEYWORDS.some(kw => combined.includes(kw))) return true;
  if (vendorKeywords.some(name => combined.includes(name))) return true;
  return false;
}

/**
 * POST /api/gmail/scan-regex
 *
 * ZERO AI email scan. Uses keyword pre-filter + regex extraction only.
 * Same pagination/dedup logic as the AI scan route.
 *
 * Body: { account_id, page_token?, total_processed? }
 */
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  // GDPR beperking: block data processing for restricted accounts
  const { isAccountRestricted } = await import('@/lib/auth');
  if (await isAccountRestricted(userId)) {
    return NextResponse.json({ error: 'Account is bevroren. Neem contact op met je organisatie.' }, { status: 403, headers: NO_CACHE });
  }

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

    const [accountResult, vendorKeywords] = await Promise.all([
      supabase.from('gmail_accounts').select('full_scan_complete').eq('id', account_id).eq('user_id', userId).single(),
      loadVendorKeywords(supabase),
    ]);

    const isFirstScan = !accountResult.data?.full_scan_complete;
    const maxEmails = isFirstScan ? MAX_EMAILS_FIRST_SCAN : MAX_EMAILS_RESCAN;

    if (total_processed >= maxEmails) {
      return NextResponse.json({ processed: 0, bills_found: 0, page_token: null, total_processed: maxEmails, done: true, method: 'regex' }, { headers: NO_CACHE });
    }

    guard();
    console.log(`[Gmail Regex] account=${account_id}, first=${isFirstScan}, processed=${total_processed}`);
    const tokens = await getValidTokens(account_id, userId);
    if (!tokens) {
      return NextResponse.json({ error: 'Gmail needs re-authentication', needs_reauth: true }, { status: 401, headers: NO_CACHE });
    }

    guard();
    const messageList = await listMessages(tokens.accessToken, BATCH_SIZE, page_token);

    if (!messageList.messages || messageList.messages.length === 0) {
      console.log('[Gmail Regex] No more messages');
      // Don't mark full_scan_complete — this is a test route, shouldn't affect the main scan
      return NextResponse.json({ processed: 0, bills_found: 0, page_token: null, total_processed, done: true, method: 'regex' }, { headers: NO_CACHE });
    }

    guard();
    const messageIds = messageList.messages.map((m) => m.id);
    const snippets = await getMessageSnippets(tokens.accessToken, messageIds);
    console.log(`[Gmail Regex] Got ${snippets.length} snippets`);

    let billsFound = 0;
    let skippedByKeyword = 0;
    let lowConfidence = 0;

    for (const snippet of snippets) {
      guard();

      // Skip already processed (use same scan_processed table)
      const { data: alreadyDone } = await supabase
        .from('scan_processed')
        .select('gmail_message_id')
        .eq('user_id', userId)
        .eq('gmail_message_id', `regex_${snippet.id}`) // prefix to not conflict with AI scan
        .maybeSingle();

      if (alreadyDone) continue;

      // ─── Keyword pre-filter (deterministic, <1ms) ───
      if (!mightBeBill(snippet.subject || '', snippet.from || '', snippet.snippet || '', vendorKeywords)) {
        skippedByKeyword++;
        await markProcessed(supabase, userId, snippet.id);
        continue;
      }

      // ─── Get full email body ───
      try {
        guard();
        const detail = await getMessageDetail(tokens.accessToken, snippet.id);

        // Combine email body + PDF text for regex
        let fullText = '';

        // Strip HTML from email body
        if (detail.body) {
          fullText = stripHtml(detail.body);
        }

        // Also extract PDF text if available
        if (detail.hasAttachments && detail.rawPayload) {
          try {
            guard();
            const pdfParts = findPdfAttachments(detail.rawPayload);
            if (pdfParts.length > 0) {
              const firstPdf = pdfParts[0];
              console.log(`[Gmail Regex] Found PDF: ${firstPdf.filename}`);
              guard();
              const pdfBuffer = await fetchAttachmentData(tokens.accessToken, snippet.id, firstPdf.attachmentId);
              if (pdfBuffer) {
                const pdfText = await extractPdfText(pdfBuffer);
                if (pdfText) {
                  fullText = fullText + '\n\n' + pdfText;
                  console.log(`[Gmail Regex] PDF text: ${pdfText.length} chars`);
                }
              }
            }
          } catch (pdfErr) {
            console.error(`[Gmail Regex] PDF extraction failed:`, pdfErr);
          }
        }

        if (fullText.trim().length < 20) {
          await markProcessed(supabase, userId, snippet.id);
          continue;
        }

        // ─── REGEX EXTRACTION (zero AI) ───
        guard();
        const extracted = await extractFromText(
          fullText,
          snippet.from, // sender email for domain lookup
          snippet.from  // also used as sender name
        );

        console.log(`[Gmail Regex] "${snippet.subject?.slice(0, 40)}" → confidence=${extracted.confidence}, fields=[${extracted.fields_found.join(',')}], sources=[${extracted.match_sources.join(',')}]`);

        // Only save if we have enough data (at minimum vendor + amount)
        if (extracted.confidence < MIN_CONFIDENCE || !extracted.vendor || !extracted.amount_cents) {
          lowConfidence++;
          await markProcessed(supabase, userId, snippet.id);

          // Log the low-confidence extraction for review
          try {
            await supabase.from('extraction_log').insert({
              user_id: userId,
              source: 'email_scan',
              method: 'regex',
              extracted_vendor: extracted.vendor,
              extracted_amount_cents: extracted.amount_cents,
              extracted_iban: extracted.iban,
              extracted_due_date: extracted.due_date,
              extracted_reference: extracted.reference,
              extracted_escalation: extracted.escalation_stage,
              extracted_category: extracted.category_hint,
              fields_found: extracted.fields_found,
              match_sources: extracted.match_sources,
              extraction_confidence: extracted.confidence,
              user_edited: false,
              sender_email: snippet.from,
              error_message: extracted.confidence < MIN_CONFIDENCE ? `Low confidence: ${extracted.confidence}` : null,
            });
          } catch { /* non-critical */ }

          continue;
        }

        // ─── DEDUP + SAVE (same logic as AI route) ───
        const hash = computeBillHash(
          extracted.vendor,
          extracted.amount_cents,
          extracted.reference || '',
          extracted.due_date || new Date().toISOString().split('T')[0]
        );

        let handled = false;

        // Smart dedup by reference
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
              await supabase.from('bills').update({
                amount: extracted.amount_cents,
                hash,
                escalation_stage: extracted.escalation_stage || undefined,
                updated_at: new Date().toISOString(),
              }).eq('id', existingByRef.id);
              billsFound++;
              console.log(`[Gmail Regex] Updated: ${extracted.vendor} (amount changed)`);
            }
            handled = true;
          }
        }

        // Hash dedup
        if (!handled) {
          const { data: existingByHash } = await supabase
            .from('bills').select('id').eq('user_id', userId).eq('hash', hash).maybeSingle();
          if (existingByHash) handled = true;
        }

        if (!handled) {
          const billId = generateBillId();
          const { error: insertErr } = await supabase.from('bills').insert({
            id: billId,
            user_id: userId,
            vendor: extracted.vendor,
            amount: extracted.amount_cents,
            currency: 'EUR',
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
            estimated_extra_costs: 0,
            original_email_subject: detail.subject,
            original_email_from: detail.from,
            payment_url: extracted.payment_url || null,
          });

          if (!insertErr) {
            billsFound++;
            console.log(`[Gmail Regex] New: ${extracted.vendor} - €${(extracted.amount_cents / 100).toFixed(2)} [${extracted.match_sources.join(',')}]`);
          } else {
            console.error(`[Gmail Regex] Insert error:`, insertErr);
          }
        }

        // Log successful extraction
        try {
          await supabase.from('extraction_log').insert({
            user_id: userId,
            source: 'email_scan',
            method: 'regex',
            extracted_vendor: extracted.vendor,
            extracted_amount_cents: extracted.amount_cents,
            extracted_iban: extracted.iban,
            extracted_due_date: extracted.due_date,
            extracted_reference: extracted.reference,
            extracted_escalation: extracted.escalation_stage,
            extracted_category: extracted.category_hint,
            fields_found: extracted.fields_found,
            match_sources: extracted.match_sources,
            extraction_confidence: extracted.confidence,
            user_edited: false,
            sender_email: snippet.from,
          });
        } catch { /* non-critical */ }

      } catch (err) {
        console.error(`[Gmail Regex] Error for ${snippet.id}:`, err);
      }

      await markProcessed(supabase, userId, snippet.id);
    }

    const newTotal = total_processed + snippets.length;
    const shouldStop = newTotal >= maxEmails || !messageList.nextPageToken;

    console.log(`[Gmail Regex] Batch: ${snippets.length} processed, ${skippedByKeyword} skipped, ${lowConfidence} low-confidence, ${billsFound} bills`);

    return NextResponse.json({
      processed: snippets.length,
      bills_found: billsFound,
      skipped_keyword: skippedByKeyword,
      low_confidence: lowConfidence,
      page_token: shouldStop ? null : messageList.nextPageToken,
      total_processed: newTotal,
      max_emails: maxEmails,
      done: shouldStop,
      method: 'regex',
    }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Batch timeout — resuming', timeout: true, total_processed, method: 'regex' }, { status: 200, headers: NO_CACHE });
    }
    console.error('[Gmail Regex] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scan failed' }, { status: 500, headers: NO_CACHE });
  }
}

async function markProcessed(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  messageId: string
) {
  await supabase.from('scan_processed').upsert(
    { user_id: userId, gmail_message_id: `regex_${messageId}` },
    { onConflict: 'user_id,gmail_message_id' }
  );
}
