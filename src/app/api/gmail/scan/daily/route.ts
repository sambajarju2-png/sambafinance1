import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getValidTokens } from '@/lib/gmail/tokens';
import { listMessages, getMessageSnippets, getMessageDetail } from '@/lib/gmail/api';
import { classifyEmail, extractBillFromEmail } from '@/lib/ai';
import { computeBillHash, generateBillId } from '@/lib/bills-server';

const NO_CACHE = { 'Cache-Control': 'no-store' };
const MAX_EMAILS_PER_ACCOUNT = 50;

/**
 * POST /api/gmail/scan/daily
 *
 * Cron job — runs daily at 11:00 AM.
 * Scans only emails from the last 24 hours.
 * Max 50 emails per account.
 * Protected by CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  try {
    const supabase = createServiceRoleClient();

    // Get all Gmail accounts that completed first scan
    const { data: accounts } = await supabase
      .from('gmail_accounts')
      .select('id, user_id, email')
      .eq('full_scan_complete', true)
      .eq('needs_reauth', false);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: 'No accounts to scan', scanned: 0 }, { headers: NO_CACHE });
    }

    // Gmail date filter: last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateFilter = `after:${yesterday.getFullYear()}/${yesterday.getMonth() + 1}/${yesterday.getDate()}`;

    let totalScanned = 0;
    let totalBills = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        guard();
        console.log(`[Daily scan] Scanning ${account.email} (${account.id})`);

        const tokens = await getValidTokens(account.id, account.user_id);
        if (!tokens) {
          console.log(`[Daily scan] ${account.email} needs reauth`);
          await supabase.from('gmail_accounts').update({ needs_reauth: true }).eq('id', account.id);
          continue;
        }

        let pageToken: string | null = null;
        let accountProcessed = 0;
        let accountBills = 0;

        // Paginate through last 24h emails
        while (accountProcessed < MAX_EMAILS_PER_ACCOUNT) {
          guard();
          const remaining = MAX_EMAILS_PER_ACCOUNT - accountProcessed;
          const batchSize = Math.min(10, remaining);

          const messageList = await listMessages(tokens.accessToken, batchSize, pageToken, dateFilter);

          if (!messageList.messages || messageList.messages.length === 0) break;

          const messageIds = messageList.messages.map((m) => m.id);
          const snippets = await getMessageSnippets(tokens.accessToken, messageIds);

          for (const snippet of snippets) {
            guard();

            // Skip already processed
            const { data: alreadyDone } = await supabase
              .from('scan_processed')
              .select('gmail_message_id')
              .eq('user_id', account.user_id)
              .eq('gmail_message_id', snippet.id)
              .maybeSingle();

            if (alreadyDone) { accountProcessed++; continue; }

            // Classify
            let isBill = false;
            try {
              const classification = await classifyEmail(snippet.subject, snippet.from, snippet.snippet, account.user_id);
              isBill = classification.is_bill && classification.confidence > 0.6;
            } catch {
              await markProcessed(supabase, account.user_id, snippet.id);
              accountProcessed++;
              continue;
            }

            if (isBill) {
              try {
                guard();
                const detail = await getMessageDetail(tokens.accessToken, snippet.id);
                guard();
                const extracted = await extractBillFromEmail(detail.subject, detail.body, null, account.user_id);

                const hash = computeBillHash(
                  extracted.vendor,
                  extracted.amount_cents,
                  extracted.reference || '',
                  extracted.due_date || new Date().toISOString().split('T')[0]
                );

                // Smart dedup
                let handled = false;
                if (extracted.reference) {
                  const { data: existingByRef } = await supabase
                    .from('bills')
                    .select('id, amount')
                    .eq('user_id', account.user_id)
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
                        estimated_extra_costs: extracted.estimated_extra_costs_cents || undefined,
                        updated_at: new Date().toISOString(),
                      }).eq('id', existingByRef.id);
                      accountBills++;
                    }
                    handled = true;
                  }
                }

                if (!handled) {
                  const { data: existingByHash } = await supabase
                    .from('bills').select('id').eq('user_id', account.user_id).eq('hash', hash).maybeSingle();
                  if (existingByHash) handled = true;
                }

                if (!handled) {
                  await supabase.from('bills').insert({
                    id: generateBillId(),
                    user_id: account.user_id,
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
                    gmail_account_id: account.id,
                    hash,
                    escalation_stage: extracted.escalation_stage || 'factuur',
                    estimated_extra_costs: extracted.estimated_extra_costs_cents || 0,
                    original_email_subject: detail.subject,
                    original_email_from: detail.from,
                  });
                  accountBills++;
                }
              } catch (err) {
                console.error(`[Daily scan] Extraction error:`, err);
              }
            }

            await markProcessed(supabase, account.user_id, snippet.id);
            accountProcessed++;
          }

          if (!messageList.nextPageToken) break;
          pageToken = messageList.nextPageToken;
        }

        // Update last_scanned
        await supabase.from('gmail_accounts').update({
          last_scanned: new Date().toISOString(),
        }).eq('id', account.id);

        totalScanned += accountProcessed;
        totalBills += accountBills;
        console.log(`[Daily scan] ${account.email}: ${accountProcessed} emails, ${accountBills} bills`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        if (msg === 'TIMEOUT_ABORT') break;
        errors.push(`${account.email}: ${msg}`);
        console.error(`[Daily scan] ${account.email} error:`, err);
      }
    }

    return NextResponse.json({
      scanned: totalScanned,
      bills_found: totalBills,
      accounts: accounts.length,
      errors: errors.length > 0 ? errors : undefined,
    }, { headers: NO_CACHE });
  } catch (err) {
    console.error('[Daily scan] Fatal error:', err);
    return NextResponse.json({ error: 'Daily scan failed' }, { status: 500, headers: NO_CACHE });
  }
}

async function markProcessed(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  messageId: string
) {
  await supabase.from('scan_processed').upsert(
    { user_id: userId, gmail_message_id: messageId },
    { onConflict: 'user_id,gmail_message_id' }
  );
}
