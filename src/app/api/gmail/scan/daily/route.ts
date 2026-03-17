import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/encryption';
import { listMessages, getMessageSnippets, getMessageDetail } from '@/lib/gmail/api';
import { classifyEmail, extractBillFromEmail } from '@/lib/ai';
import { computeBillHash, generateBillId } from '@/lib/bills-server';

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

const MAX_EMAILS_PER_ACCOUNT = 40;

/**
 * POST /api/gmail/scan/daily
 *
 * Daily cron scan triggered by cron-job.org at 11 AM.
 * Scans 40 most recent emails per account that hasn't been scanned in 24h.
 * Protected by CRON_SECRET header.
 */
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => {
    if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT');
  };

  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500, headers: NO_CACHE });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
    }

    const supabase = createServiceRoleClient();

    // Find accounts not scanned in 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: accounts, error: accountsErr } = await supabase
      .from('gmail_accounts')
      .select('id, user_id, email, access_token, refresh_token, token_expires_at, needs_reauth')
      .or(`last_scanned.is.null,last_scanned.lt.${twentyFourHoursAgo}`)
      .eq('needs_reauth', false);

    if (accountsErr) {
      console.error('Failed to fetch Gmail accounts:', accountsErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500, headers: NO_CACHE });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: 'No accounts need scanning', accounts_scanned: 0 }, { headers: NO_CACHE });
    }

    let totalAccountsScanned = 0;
    let totalBillsFound = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      guard();

      try {
        // Decrypt and validate token
        let accessToken: string;
        try {
          accessToken = decrypt(account.access_token);
        } catch {
          await supabase.from('gmail_accounts').update({ needs_reauth: true }).eq('id', account.id);
          errors.push(`${account.email}: token decryption failed`);
          continue;
        }

        // Refresh token if expired
        const now = Math.floor(Date.now() / 1000);
        if (account.token_expires_at && account.token_expires_at < now + 60) {
          try {
            const refreshToken = decrypt(account.refresh_token);
            const refreshResult = await refreshGoogleToken(refreshToken);
            if (!refreshResult) {
              await supabase.from('gmail_accounts').update({ needs_reauth: true }).eq('id', account.id);
              errors.push(`${account.email}: token refresh failed`);
              continue;
            }
            accessToken = refreshResult.accessToken;

            const { encrypt } = await import('@/lib/encryption');
            await supabase.from('gmail_accounts').update({
              access_token: encrypt(refreshResult.accessToken),
              token_expires_at: Math.floor(Date.now() / 1000) + refreshResult.expiresIn,
            }).eq('id', account.id);
          } catch {
            await supabase.from('gmail_accounts').update({ needs_reauth: true }).eq('id', account.id);
            errors.push(`${account.email}: token refresh error`);
            continue;
          }
        }

        // Scan up to 40 emails
        guard();
        let totalProcessed = 0;
        let accountBillsFound = 0;
        let pageToken: string | null = null;

        while (totalProcessed < MAX_EMAILS_PER_ACCOUNT) {
          guard();

          const batchSize = Math.min(10, MAX_EMAILS_PER_ACCOUNT - totalProcessed);
          const messageList = await listMessages(accessToken, batchSize, pageToken);

          if (!messageList.messages || messageList.messages.length === 0) break;

          const messageIds = messageList.messages.map((m) => m.id);
          const snippets = await getMessageSnippets(accessToken, messageIds);

          for (const snippet of snippets) {
            guard();

            // Skip already processed
            const { data: existing } = await supabase
              .from('scan_processed')
              .select('gmail_message_id')
              .eq('user_id', account.user_id)
              .eq('gmail_message_id', snippet.id)
              .maybeSingle();

            if (existing) continue;

            // Classify
            let isBill = false;
            try {
              const result = await classifyEmail(
                snippet.subject,
                snippet.from,
                snippet.snippet,
                account.user_id
              );
              isBill = result.is_bill && result.confidence > 0.6;
            } catch (err) {
              console.error('Classification error:', snippet.id, err);
            }

            if (isBill) {
              guard();
              try {
                const detail = await getMessageDetail(accessToken, snippet.id);

                guard();
                const extracted = await extractBillFromEmail(
                  detail.subject,
                  detail.body,
                  null,
                  account.user_id
                );

                const hash = computeBillHash(
                  extracted.vendor,
                  extracted.amount_cents,
                  extracted.reference || '',
                  extracted.due_date || new Date().toISOString().split('T')[0]
                );

                // Smart dedup
                const { data: existingByHash } = await supabase
                  .from('bills')
                  .select('id')
                  .eq('user_id', account.user_id)
                  .eq('hash', hash)
                  .maybeSingle();

                if (!existingByHash) {
                  let updated = false;

                  if (extracted.reference) {
                    const { data: existingByRef } = await supabase
                      .from('bills')
                      .select('id, amount')
                      .eq('user_id', account.user_id)
                      .eq('vendor', extracted.vendor)
                      .eq('reference', extracted.reference)
                      .neq('status', 'settled')
                      .maybeSingle();

                    if (existingByRef && existingByRef.amount !== extracted.amount_cents) {
                      await supabase.from('bills').update({
                        amount: extracted.amount_cents,
                        hash,
                        escalation_stage: extracted.escalation_stage || undefined,
                        estimated_extra_costs: extracted.estimated_extra_costs_cents || undefined,
                        updated_at: new Date().toISOString(),
                      }).eq('id', existingByRef.id);
                      updated = true;
                      accountBillsFound++;
                    } else if (existingByRef) {
                      updated = true;
                    }
                  }

                  if (!updated) {
                    const billId = generateBillId();
                    const { error: insertErr } = await supabase.from('bills').insert({
                      id: billId,
                      user_id: account.user_id,
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
                      gmail_account_id: account.id,
                      hash,
                      escalation_stage: extracted.escalation_stage || 'factuur',
                      estimated_extra_costs: extracted.estimated_extra_costs_cents || 0,
                      original_email_subject: detail.subject,
                      original_email_from: detail.from,
                      payment_url: extracted.payment_url || null,
                      vendor_contact: extracted.vendor_contact || null,
                    });
                    if (!insertErr) accountBillsFound++;
                  }
                }
              } catch (err) {
                console.error('Extraction error:', snippet.id, err);
              }
            }

            // Mark processed
            await supabase.from('scan_processed').upsert(
              { user_id: account.user_id, gmail_message_id: snippet.id },
              { onConflict: 'user_id,gmail_message_id' }
            );
          }

          totalProcessed += snippets.length;
          pageToken = messageList.nextPageToken;
          if (!pageToken) break;
        }

        // Update last_scanned
        await supabase.from('gmail_accounts').update({
          last_scanned: new Date().toISOString(),
        }).eq('id', account.id);

        totalAccountsScanned++;
        totalBillsFound += accountBillsFound;
        console.log(`Daily scan: ${account.email} — ${accountBillsFound} new bills`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Daily scan error for ${account.email}:`, errMsg);
        errors.push(`${account.email}: ${errMsg}`);
        if (errMsg === 'TIMEOUT_ABORT') break;
      }
    }

    return NextResponse.json({
      accounts_scanned: totalAccountsScanned,
      bills_found: totalBillsFound,
      errors: errors.length > 0 ? errors : undefined,
    }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Cron timeout — partial scan', timeout: true }, { status: 200, headers: NO_CACHE });
    }
    console.error('Daily scan cron error:', err);
    return NextResponse.json({ error: 'Cron scan failed' }, { status: 500, headers: NO_CACHE });
  }
}

async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return { accessToken: data.access_token, expiresIn: data.expires_in || 3600 };
  } catch {
    return null;
  }
}
