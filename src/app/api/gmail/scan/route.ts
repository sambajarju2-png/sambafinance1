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

    // Step 1: Fetch batch of message IDs
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
    let billsFound = 0;
    let processed = 0;

    for (const snippet of snippets) {
      guard();

      // Check if already processed (dedup at scan level)
      const { data: existing } = await supabase
        .from('scan_processed')
        .select('gmail_message_id')
        .eq('user_id', userId)
        .eq('gmail_message_id', snippet.id)
        .single();

      if (existing) {
        processed++;
        continue;
      }

      // Classify with Gemini
      guard();
      let classification;
      try {
        classification = await classifyEmail(
          snippet.subject,
          snippet.from,
          snippet.snippet,
          userId
        );
      } catch (err) {
        console.error('Classification error for message', snippet.id, err);
        // Mark as processed to not retry
        await markProcessed(supabase, userId, snippet.id);
        processed++;
        continue;
      }

      // If not a bill, skip
      if (!classification.is_bill || classification.confidence < 0.5) {
        await markProcessed(supabase, userId, snippet.id);
        processed++;
        continue;
      }

      // Step 4: This IS a bill — get full message detail
      guard();
      let detail;
      try {
        detail = await getMessageDetail(tokens.accessToken, snippet.id);
      } catch (err) {
        console.error('Message detail fetch error:', snippet.id, err);
        await markProcessed(supabase, userId, snippet.id);
        processed++;
        continue;
      }

      // Step 5: Extract bill data with Haiku
      guard();
      let extraction;
      try {
        extraction = await extractBillFromEmail(
          detail.subject,
          detail.body,
          null, // PDF extraction deferred to future step
          userId
        );
      } catch (err) {
        console.error('Extraction error for message', snippet.id, err);
        await markProcessed(supabase, userId, snippet.id);
        processed++;
        continue;
      }

      // Step 6: Dedup check and insert
      guard();
      if (extraction.amount_cents > 0 && extraction.vendor) {
        const hash = computeBillHash(
          extraction.vendor,
          extraction.amount_cents,
          extraction.reference,
          extraction.due_date || new Date().toISOString().split('T')[0]
        );

        // Check if bill already exists
        const { data: existingBill } = await supabase
          .from('bills')
          .select('id')
          .eq('user_id', userId)
          .eq('hash', hash)
          .single();

        if (!existingBill) {
          const billId = generateBillId();
          const today = new Date().toISOString().split('T')[0];
          const dueDate = extraction.due_date || today;
          const isOverdue = dueDate < today;

          await supabase.from('bills').insert({
            id: billId,
            user_id: userId,
            vendor: extraction.vendor,
            amount: extraction.amount_cents,
            currency: extraction.currency || 'EUR',
            iban: extraction.iban,
            reference: extraction.reference,
            due_date: dueDate,
            received_date: extraction.received_date || today,
            category: extraction.category_hint || 'overig',
            status: isOverdue ? 'action' : 'outstanding',
            source: 'gmail_scan',
            gmail_message_id: snippet.id,
            gmail_account_id: account_id,
            hash,
            payment_url: extraction.payment_url,
            vendor_contact: extraction.vendor_contact || {},
            escalation_stage: extraction.escalation_stage || 'factuur',
            estimated_extra_costs: extraction.estimated_extra_costs_cents || 0,
            original_email_subject: detail.subject,
            original_email_from: detail.from,
            requires_review: (extraction.confidence?.amount || 0) < 0.7,
          });

          billsFound++;
        }
      }

      await markProcessed(supabase, userId, snippet.id);
      processed++;
    }

    // Update scan progress
    await supabase
      .from('gmail_accounts')
      .update({
        scan_cursor: messageList.nextPageToken || null,
        scan_progress: processed,
        last_scanned: new Date().toISOString(),
        full_scan_complete: !messageList.nextPageToken,
      })
      .eq('id', account_id)
      .eq('user_id', userId);

    return NextResponse.json({
      processed,
      bills_found: billsFound,
      page_token: messageList.nextPageToken,
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
