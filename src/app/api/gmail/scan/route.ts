import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getValidTokens } from '@/lib/gmail/tokens';
import { listMessages, getMessageSnippets, getMessageDetail } from '@/lib/gmail/api';
import { classifyEmail, extractBillFromEmail } from '@/lib/ai';
import { computeBillHash, generateBillId } from '@/lib/bills-server';

// For free Vercel: 8s timeout (2s buffer from 10s limit)
// For Pro Vercel: change to 55000
const TIMEOUT_MS = 8000;
const BATCH_SIZE = 5; // Small batches for free tier
const MAX_EMAILS_PER_SCAN = 20; // Cap total emails scanned

export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + TIMEOUT_MS;
  const guard = () => {
    if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT');
  };

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    const body = await req.json();
    const { account_id, page_token, total_processed = 0 } = body;

    if (!account_id) {
      return NextResponse.json({ error: 'account_id is required' }, { status: 400, headers: NO_CACHE });
    }

    // Check if we've hit the max email limit
    if (total_processed >= MAX_EMAILS_PER_SCAN) {
      const supabase = await createServerSupabaseClient();
      await supabase
        .from('gmail_accounts')
        .update({ last_scanned: new Date().toISOString(), full_scan_complete: true })
        .eq('id', account_id)
        .eq('user_id', userId);

      return NextResponse.json({
        processed: 0,
        bills_found: 0,
        page_token: null,
        total_processed: total_processed,
        done: true,
      }, { headers: NO_CACHE });
    }

    guard();
    const tokens = await getValidTokens(account_id, userId);
    if (!tokens) {
      return NextResponse.json(
        { error: 'Gmail account needs re-authentication', needs_reauth: true },
        { status: 401, headers: NO_CACHE }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Fetch small batch of message IDs
    guard();
    const remaining = MAX_EMAILS_PER_SCAN - total_processed;
    const batchSize = Math.min(BATCH_SIZE, remaining);
    const messageList = await listMessages(tokens.accessToken, batchSize, page_token || null);

    if (!messageList.messages || messageList.messages.length === 0) {
      await supabase
        .from('gmail_accounts')
        .update({ last_scanned: new Date().toISOString(), full_scan_complete: true, scan_cursor: null })
        .eq('id', account_id)
        .eq('user_id', userId);

      return NextResponse.json({
        processed: 0,
        bills_found: 0,
        page_token: null,
        total_processed: total_processed,
        done: true,
      }, { headers: NO_CACHE });
    }

    guard();
    const messageIds = messageList.messages.map((m) => m.id);
    const snippets = await getMessageSnippets(tokens.accessToken, messageIds);

    let billsFound = 0;
    let processed = 0;

    for (const snippet of snippets) {
      guard();

      // Skip if already processed
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
        classification = await classifyEmail(snippet.subject, snippet.from, snippet.snippet, userId);
      } catch (err) {
        console.error('Classification error for message', snippet.id, err);
        await markProcessed(supabase, userId, snippet.id);
        processed++;
        continue;
      }

      if (!classification.is_bill || classification.confidence < 0.5) {
        await markProcessed(supabase, userId, snippet.id);
        processed++;
        continue;
      }

      // Get full message detail
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

      // Extract with Haiku
      guard();
      let extraction;
      try {
        extraction = await extractBillFromEmail(detail.subject, detail.body, null, userId);
      } catch (err) {
        console.error('Extraction error for message', snippet.id, err);
        await markProcessed(supabase, userId, snippet.id);
        processed++;
        continue;
      }

      // Dedup and insert
      guard();
      if (extraction.amount_cents > 0 && extraction.vendor) {
        const hash = computeBillHash(
          extraction.vendor,
          extraction.amount_cents,
          extraction.reference,
          extraction.due_date || new Date().toISOString().split('T')[0]
        );

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

          // Auto-detect escalation from overdue days
          const escalation = extraction.escalation_stage || autoDetectEscalation(dueDate, today);

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
            status: dueDate < today ? 'action' : 'outstanding',
            source: 'gmail_scan',
            gmail_message_id: snippet.id,
            gmail_account_id: account_id,
            hash,
            payment_url: extraction.payment_url,
            vendor_contact: extraction.vendor_contact || {},
            escalation_stage: escalation,
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

    const newTotal = total_processed + processed;
    const isDone = !messageList.nextPageToken || newTotal >= MAX_EMAILS_PER_SCAN;

    await supabase
      .from('gmail_accounts')
      .update({
        scan_cursor: isDone ? null : messageList.nextPageToken,
        scan_progress: newTotal,
        last_scanned: new Date().toISOString(),
        full_scan_complete: isDone,
      })
      .eq('id', account_id)
      .eq('user_id', userId);

    return NextResponse.json({
      processed,
      bills_found: billsFound,
      page_token: isDone ? null : messageList.nextPageToken,
      total_processed: newTotal,
      done: isDone,
    }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({
        error: 'Batch timeout — will resume on next call',
        timeout: true,
      }, { status: 200, headers: NO_CACHE });
    }
    console.error('Gmail scan error:', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500, headers: NO_CACHE });
  }
}

/**
 * Auto-detect escalation stage based on how overdue a bill is.
 * Used when AI doesn't detect a specific stage from email content.
 */
function autoDetectEscalation(dueDate: string, today: string): string {
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

  if (daysOverdue <= 0) return 'factuur';
  if (daysOverdue <= 14) return 'herinnering';
  if (daysOverdue <= 30) return 'aanmaning';
  if (daysOverdue <= 60) return 'incasso';
  return 'deurwaarder';
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
