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

/**
 * POST /api/gmail/scan/daily
 *
 * Daily cron scan triggered by cron-job.org at 11 AM.
 * Scans all Gmail accounts that haven't been scanned in 24h.
 * Fetches 100 most recent emails per account.
 *
 * Protected by CRON_SECRET header.
 */
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000; // 55s Vercel Pro guard
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

    // Find all Gmail accounts that haven't been scanned in 24 hours
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
      return NextResponse.json({
        message: 'No accounts need scanning',
        accounts_scanned: 0,
      }, { headers: NO_CACHE });
    }

    let totalAccountsScanned = 0;
    let totalBillsFound = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      guard();

      try {
        // Decrypt tokens
        let accessToken: string;
        try {
          accessToken = decrypt(account.access_token);
        } catch {
          console.error(`Failed to decrypt token for account ${account.email}`);
          // Mark as needing reauth
          await supabase
            .from('gmail_accounts')
            .update({ needs_reauth: true })
            .eq('id', account.id);
          errors.push(`${account.email}: token decryption failed`);
          continue;
        }

        // Check if token is expired, try refresh
        const now = Math.floor(Date.now() / 1000);
        if (account.token_expires_at && account.token_expires_at < now + 60) {
          // Token expired, try to refresh
          try {
            const refreshToken = decrypt(account.refresh_token);
            const refreshResult = await refreshGoogleToken(refreshToken);

            if (!refreshResult) {
              await supabase
                .from('gmail_accounts')
                .update({ needs_reauth: true })
                .eq('id', account.id);
              errors.push(`${account.email}: token refresh failed`);
              continue;
            }

            accessToken = refreshResult.accessToken;

            // Re-encrypt and update
            const { encrypt } = await import('@/lib/encryption');
            await supabase
              .from('gmail_accounts')
              .update({
                access_token: encrypt(refreshResult.accessToken),
                token_expires_at: Math.floor(Date.now() / 1000) + refreshResult.expiresIn,
              })
              .eq('id', account.id);
          } catch {
            await supabase
              .from('gmail_accounts')
              .update({ needs_reauth: true })
              .eq('id', account.id);
            errors.push(`${account.email}: token refresh error`);
            continue;
          }
        }

        // Scan 100 most recent emails (no date filter)
        // Fetch in batches of 50 message IDs
        guard();
        let pageToken: string | null = null;
        let totalProcessed = 0;
        let accountBillsFound = 0;
        const MAX_EMAILS = 100;

        while (totalProcessed < MAX_EMAILS) {
          guard();

          const batchSize = Math.min(50, MAX_EMAILS - totalProcessed);
          const messageList = await listMessages(accessToken, batchSize, pageToken);

          if (!messageList.messages || messageList.messages.length === 0) break;

          // Get snippets for classification
          guard();
          const messageIds = messageList.messages.map((m) => m.id);
          const snippets = await getMessageSnippets(accessToken, messageIds);

          // Skip already processed
          const unprocessed: typeof snippets = [];
          for (const snippet of snippets) {
            const { data: existing } = await supabase
              .from('scan_processed')
              .select('gmail_message_id')
              .eq('user_id', account.user_id)
              .eq('gmail_message_id', snippet.id)
              .maybeSingle();

            if (!existing) {
              unprocessed.push(snippet);
            }
          }

          if (unprocessed.length > 0) {
            // Classify with Gemini
            guard();
            const classifications = await classifyEmail(
              unprocessed.map((s) => ({
                id: s.id,
                subject: s.subject,
                from: s.from,
                snippet: s.snippet,
              })),
              account.user_id
            );

            // Process confirmed bills
            const billEmails = classifications.filter((c) => c.is_bill && c.confidence > 0.6);

            for (const billEmail of billEmails) {
              guard();

              const detail = await getMessageDetail(accessToken, billEmail.id);

              guard();
              const extracted = await extractBillFromEmail(
                detail.subject,
                detail.body,
                null,
                account.user_id
              );

              const hash = await computeBillHash(
                extracted.vendor,
                extracted.amount_cents,
                extracted.reference || ''
              );

              // Check bill dedup
              const { data: existingBill } = await supabase
                .from('bills')
                .select('id')
                .eq('user_id', account.user_id)
                .eq('hash', hash)
                .maybeSingle();

              if (!existingBill) {
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
                  category: extracted.category || 'Overig',
                  status: 'outstanding',
                  source: 'gmail_scan',
                  gmail_message_id: billEmail.id,
                  gmail_account_id: account.id,
                  hash,
                  escalation_stage: extracted.escalation_stage || 'factuur',
                  estimated_extra_costs: extracted.estimated_extra_costs || 0,
                  original_email_subject: detail.subject,
                  original_email_from: detail.from,
                  payment_url: extracted.payment_url || null,
                  vendor_contact: extracted.vendor_contact || null,
                });

                if (!insertErr) accountBillsFound++;
              }

              // Mark processed
              await supabase.from('scan_processed').upsert(
                { user_id: account.user_id, gmail_message_id: billEmail.id },
                { onConflict: 'user_id,gmail_message_id' }
              );
            }

            // Mark non-bills as processed too
            for (const email of classifications.filter((c) => !c.is_bill)) {
              await supabase.from('scan_processed').upsert(
                { user_id: account.user_id, gmail_message_id: email.id },
                { onConflict: 'user_id,gmail_message_id' }
              );
            }
          }

          totalProcessed += snippets.length;
          pageToken = messageList.nextPageToken;

          if (!pageToken) break; // No more pages
        }

        // Update last_scanned
        await supabase
          .from('gmail_accounts')
          .update({
            last_scanned: new Date().toISOString(),
          })
          .eq('id', account.id);

        totalAccountsScanned++;
        totalBillsFound += accountBillsFound;

        console.log(`Daily scan: ${account.email} — ${accountBillsFound} new bills found`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Daily scan error for ${account.email}:`, errMsg);
        errors.push(`${account.email}: ${errMsg}`);

        if (errMsg === 'TIMEOUT_ABORT') break; // Stop all processing on timeout
      }
    }

    return NextResponse.json({
      accounts_scanned: totalAccountsScanned,
      bills_found: totalBillsFound,
      errors: errors.length > 0 ? errors : undefined,
    }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({
        error: 'Cron timeout — partial scan completed',
        timeout: true,
      }, { status: 200, headers: NO_CACHE });
    }
    console.error('Daily scan cron error:', err);
    return NextResponse.json({ error: 'Cron scan failed' }, { status: 500, headers: NO_CACHE });
  }
}

/**
 * Refresh a Google access token using a refresh token.
 */
async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
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

    if (!response.ok) {
      console.error('Token refresh failed:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  } catch (err) {
    console.error('Token refresh error:', err);
    return null;
  }
}
