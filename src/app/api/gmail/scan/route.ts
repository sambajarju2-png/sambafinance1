import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getValidTokens } from '@/lib/gmail/tokens';
import { listMessages, getMessageSnippets, getMessageDetail } from '@/lib/gmail/api';
import { classifyEmail, extractBillFromEmail } from '@/lib/ai';
import { computeBillHash, generateBillId } from '@/lib/bills-server';

/**
 * POST /api/gmail/scan
 *
 * Scans a batch of emails from a connected Gmail account.
 * Uses progressive batching — frontend polls this endpoint repeatedly.
 * Scans the 100 most recent inbox emails (no date filter).
 *
 * Body: { account_id: string, page_token?: string }
 * Returns: { processed, bills_found, page_token, remaining_estimate, done }
 */
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000; // 55s guard for Vercel Pro
  const guard = () => {
    if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT');
  };

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    const body = await req.json();
    const { account_id, page_token } = body;

    if (!account_id) {
      return NextResponse.json({ error: 'account_id is required' }, { status: 400, headers: NO_CACHE });
    }

    // Get valid tokens (refresh if expired)
    guard();
    const tokens = await getValidTokens(account_id, userId);
    if (!tokens) {
      return NextResponse.json(
        { error: 'Gmail account needs re-authentication', needs_reauth: true },
        { status: 401, headers: NO_CACHE }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Step 1: Fetch batch of message IDs (15 per batch for progressive scanning)
    // No date filter — we get the 100 most recent across multiple batches
    guard();
    const BATCH_SIZE = 15;
    const messageList = await listMessages(tokens.accessToken, BATCH_SIZE, page_token || null);

    if (!messageList.messages || messageList.messages.length === 0) {
      // No more messages — mark scan complete
      await supabase
        .from('gmail_accounts')
        .update({
          last_scanned: new Date().toISOString(),
          full_scan_complete: true,
          scan_cursor: null,
        })
        .eq('id', account_id)
        .eq('user_id', userId);

      return NextResponse.json({
        processed: 0,
        bills_found: 0,
        page_token: null,
        remaining_estimate: 0,
        done: true,
      }, { headers: NO_CACHE });
    }

    // Step 2: Get snippets for classification
    guard();
    const messageIds = messageList.messages.map((m) => m.id);
    const snippets = await getMessageSnippets(tokens.accessToken, messageIds);

    // Step 3: Classify each email with Gemini (which ones are bills?)
    // classifyEmail takes (subject, sender, body, userId) per email
    guard();
    const classifications: Array<{ id: string; is_bill: boolean; confidence: number }> = [];

    for (const snippet of snippets) {
      guard();
      try {
        const result = await classifyEmail(
          snippet.subject,
          snippet.from,
          snippet.snippet,
          userId
        );
        classifications.push({
          id: snippet.id,
          is_bill: result.is_bill,
          confidence: result.confidence,
        });
      } catch (err) {
        console.error('Classification error for', snippet.id, err);
        classifications.push({ id: snippet.id, is_bill: false, confidence: 0 });
      }
    }

    // Step 4: Process confirmed bills
    let billsFound = 0;
    const billEmails = classifications.filter((c) => c.is_bill && c.confidence > 0.6);

    for (const billEmail of billEmails) {
      guard();

      // Check if already processed (dedup at scan level)
      const { data: existing } = await supabase
        .from('scan_processed')
        .select('gmail_message_id')
        .eq('user_id', userId)
        .eq('gmail_message_id', billEmail.id)
        .maybeSingle();

      if (existing) continue; // Already processed, skip

      // Fetch full email content
      guard();
      const detail = await getMessageDetail(tokens.accessToken, billEmail.id);

      // Extract bill data with Haiku
      guard();
      const extracted = await extractBillFromEmail(
        detail.subject,
        detail.body,
        null, // PDF attachment support later
        userId
      );

      // Compute dedup hash
      const hash = computeBillHash(
        extracted.vendor,
        extracted.amount_cents,
        extracted.reference || '',
        extracted.due_date || new Date().toISOString().split('T')[0]
      );

      // Check if bill already exists (dedup at bill level)
      const { data: existingBill } = await supabase
        .from('bills')
        .select('id')
        .eq('user_id', userId)
        .eq('hash', hash)
        .maybeSingle();

      if (!existingBill) {
        // Insert new bill
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
          category: extracted.category || 'Overig',
          status: 'outstanding',
          source: 'gmail_scan',
          gmail_message_id: billEmail.id,
          gmail_account_id: account_id,
          hash,
          escalation_stage: extracted.escalation_stage || 'factuur',
          estimated_extra_costs: extracted.estimated_extra_costs || 0,
          original_email_subject: detail.subject,
          original_email_from: detail.from,
          payment_url: extracted.payment_url || null,
          vendor_contact: extracted.vendor_contact || null,
        });

        if (!insertErr) {
          billsFound++;
        } else {
          console.error('Bill insert error:', insertErr);
        }
      }

      // Mark as processed regardless (to avoid re-scanning)
      await markProcessed(supabase, userId, billEmail.id);
    }

    // Also mark non-bill emails as processed to avoid re-classifying
    for (const email of classifications.filter((c) => !c.is_bill)) {
      await markProcessed(supabase, userId, email.id);
    }

    // Save progress cursor
    if (messageList.nextPageToken) {
      await supabase
        .from('gmail_accounts')
        .update({
          scan_cursor: messageList.nextPageToken,
          scan_progress: (snippets.length || 0),
        })
        .eq('id', account_id)
        .eq('user_id', userId);
    }

    return NextResponse.json({
      processed: snippets.length,
      bills_found: billsFound,
      page_token: messageList.nextPageToken || null,
      remaining_estimate: messageList.nextPageToken ? messageList.resultSizeEstimate : 0,
      done: !messageList.nextPageToken,
    }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({
        error: 'Batch timeout — will resume on next call',
        timeout: true,
      }, { status: 200, headers: NO_CACHE }); // 200 so frontend retries
    }
    console.error('Gmail scan error:', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500, headers: NO_CACHE });
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
