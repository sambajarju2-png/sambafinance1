import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getValidTokens } from '@/lib/gmail/tokens';
import { listMessages, getMessageSnippets, getMessageDetail } from '@/lib/gmail/api';
import { classifyEmail, extractBillFromEmail } from '@/lib/ai';
import { computeBillHash, generateBillId } from '@/lib/bills-server';

const MAX_EMAILS_PER_SCAN = 40;
const BATCH_SIZE = 5;

/**
 * POST /api/gmail/scan
 *
 * Scans a batch of 5 emails from a connected Gmail account.
 * Frontend polls this endpoint repeatedly until done or 40 emails total.
 *
 * Body: { account_id: string, page_token?: string, total_processed?: number }
 * Returns: { processed, bills_found, page_token, total_processed, done }
 */
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
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

    // Cap at 40 emails total
    if (total_processed >= MAX_EMAILS_PER_SCAN) {
      return NextResponse.json({
        processed: 0,
        bills_found: 0,
        page_token: null,
        total_processed,
        done: true,
      }, { headers: NO_CACHE });
    }

    // Get valid tokens
    guard();
    const tokens = await getValidTokens(account_id, userId);
    if (!tokens) {
      return NextResponse.json(
        { error: 'Gmail account needs re-authentication', needs_reauth: true },
        { status: 401, headers: NO_CACHE }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Fetch batch of message IDs (5 at a time)
    guard();
    const messageList = await listMessages(tokens.accessToken, BATCH_SIZE, page_token || null);

    if (!messageList.messages || messageList.messages.length === 0) {
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
        total_processed,
        done: true,
      }, { headers: NO_CACHE });
    }

    // Get snippets
    guard();
    const messageIds = messageList.messages.map((m) => m.id);
    const snippets = await getMessageSnippets(tokens.accessToken, messageIds);

    // Classify each email with Gemini (one by one)
    let billsFound = 0;

    for (const snippet of snippets) {
      guard();

      // Skip if already processed
      const { data: alreadyDone } = await supabase
        .from('scan_processed')
        .select('gmail_message_id')
        .eq('user_id', userId)
        .eq('gmail_message_id', snippet.id)
        .maybeSingle();

      if (alreadyDone) {
        await markProcessed(supabase, userId, snippet.id);
        continue;
      }

      // Classify
      let isBill = false;
      try {
        const classification = await classifyEmail(
          snippet.subject,
          snippet.from,
          snippet.snippet,
          userId
        );
        isBill = classification.is_bill && classification.confidence > 0.6;
      } catch (err) {
        console.error('Classification error:', snippet.id, err);
      }

      if (isBill) {
        guard();
        try {
          const detail = await getMessageDetail(tokens.accessToken, snippet.id);

          guard();
          const extracted = await extractBillFromEmail(
            detail.subject,
            detail.body,
            null,
            userId
          );

          const hash = computeBillHash(
            extracted.vendor,
            extracted.amount_cents,
            extracted.reference || '',
            extracted.due_date || new Date().toISOString().split('T')[0]
          );

          // Smart dedup: check by hash first, then by vendor+reference
          const { data: existingByHash } = await supabase
            .from('bills')
            .select('id')
            .eq('user_id', userId)
            .eq('hash', hash)
            .maybeSingle();

          if (!existingByHash) {
            // Check if same vendor + reference exists with different amount
            let updated = false;
            if (extracted.reference) {
              const { data: existingByRef } = await supabase
                .from('bills')
                .select('id, amount')
                .eq('user_id', userId)
                .eq('vendor', extracted.vendor)
                .eq('reference', extracted.reference)
                .neq('status', 'settled')
                .maybeSingle();

              if (existingByRef && existingByRef.amount !== extracted.amount_cents) {
                // Amount changed — update existing bill
                await supabase.from('bills').update({
                  amount: extracted.amount_cents,
                  hash,
                  escalation_stage: extracted.escalation_stage || undefined,
                  estimated_extra_costs: extracted.estimated_extra_costs_cents || undefined,
                  updated_at: new Date().toISOString(),
                }).eq('id', existingByRef.id);
                updated = true;
                billsFound++;
              } else if (existingByRef) {
                updated = true; // exact match, skip
              }
            }

            if (!updated) {
              // New bill — insert
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
                category: extracted.category_hint || 'Overig',
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
              if (!insertErr) billsFound++;
            }
          }
        } catch (err) {
          console.error('Extraction error:', snippet.id, err);
        }
      }

      // Mark processed regardless
      await markProcessed(supabase, userId, snippet.id);
    }

    const newTotal = total_processed + snippets.length;
    const shouldStop = newTotal >= MAX_EMAILS_PER_SCAN || !messageList.nextPageToken;

    if (shouldStop) {
      await supabase
        .from('gmail_accounts')
        .update({
          last_scanned: new Date().toISOString(),
          scan_cursor: null,
        })
        .eq('id', account_id)
        .eq('user_id', userId);
    } else {
      await supabase
        .from('gmail_accounts')
        .update({ scan_cursor: messageList.nextPageToken })
        .eq('id', account_id)
        .eq('user_id', userId);
    }

    return NextResponse.json({
      processed: snippets.length,
      bills_found: billsFound,
      page_token: shouldStop ? null : messageList.nextPageToken,
      total_processed: newTotal,
      done: shouldStop,
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
