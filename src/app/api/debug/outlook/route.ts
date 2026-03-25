/**
 * GET /api/debug/outlook
 * 
 * Debug endpoint for Outlook OAuth — ADMIN ONLY (sambajarju2@gmail.com).
 * Checks env vars, DB tables, auth state, and returns diagnostics.
 * 
 * File: src/app/api/debug/outlook/route.ts
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ['sambajarju2@gmail.com'];

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  try {
    // ── Check 1: Auth ──
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      diagnostics.checks = { auth: { status: 'FAIL', error: authError?.message || 'No user session' } };
      return NextResponse.json(diagnostics, { status: 401 });
    }

    if (!ADMIN_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    (diagnostics.checks as Record<string, unknown>).auth = {
      status: 'OK',
      user_id: user.id,
      email: user.email,
    };

    // ── Check 2: Environment Variables ──
    const envChecks: Record<string, string> = {};
    
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    envChecks.MICROSOFT_CLIENT_ID = clientId
      ? `SET (${clientId.slice(0, 8)}...${clientId.slice(-4)})`
      : 'MISSING';

    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    envChecks.MICROSOFT_CLIENT_SECRET = clientSecret
      ? `SET (${clientSecret.slice(0, 6)}...${clientSecret.slice(-4)}, length: ${clientSecret.length})`
      : 'MISSING';

    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    envChecks.MICROSOFT_REDIRECT_URI = redirectUri || 'MISSING';

    const encryptionKey = process.env.ENCRYPTION_KEY;
    envChecks.ENCRYPTION_KEY = encryptionKey
      ? `SET (length: ${encryptionKey.length})`
      : 'MISSING';

    (diagnostics.checks as Record<string, unknown>).env_vars = envChecks;

    // ── Check 3: Database Tables ──
    const serviceClient = createServiceRoleClient();

    const dbChecks: Record<string, unknown> = {};

    // Check outlook_accounts table exists
    const { data: outlookAccounts, error: oaErr } = await serviceClient
      .from('outlook_accounts')
      .select('id, email, needs_reauth, created_at')
      .eq('user_id', user.id);

    dbChecks.outlook_accounts = oaErr
      ? { status: 'ERROR', error: oaErr.message, code: oaErr.code }
      : { status: 'OK', count: outlookAccounts?.length || 0, accounts: outlookAccounts };

    // Check outlook_oauth_states table
    const { data: states, error: stErr } = await serviceClient
      .from('outlook_oauth_states')
      .select('state, user_id, expires_at')
      .eq('user_id', user.id);

    dbChecks.outlook_oauth_states = stErr
      ? { status: 'ERROR', error: stErr.message, code: stErr.code }
      : { status: 'OK', count: states?.length || 0, states: states?.map(s => ({ expires_at: s.expires_at, expired: new Date(s.expires_at) < new Date() })) };

    // Check bills source constraint
    const { data: sourceCheck, error: scErr } = await serviceClient
      .from('bills')
      .select('id')
      .eq('source', 'outlook_scan')
      .limit(1);

    dbChecks.bills_outlook_source = scErr
      ? { status: 'ERROR', error: scErr.message, hint: 'source constraint might not include outlook_scan' }
      : { status: 'OK' };

    (diagnostics.checks as Record<string, unknown>).database = dbChecks;

    // ── Check 4: OAuth URL Generation ──
    try {
      if (clientId && redirectUri) {
        const scopes = [
          'https://graph.microsoft.com/Mail.Read',
          'offline_access',
          'openid',
          'email',
        ].join(' ');

        const params = new URLSearchParams({
          client_id: clientId,
          response_type: 'code',
          redirect_uri: redirectUri,
          scope: scopes,
          state: 'test-state-debug',
          response_mode: 'query',
          prompt: 'consent',
        });

        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

        (diagnostics.checks as Record<string, unknown>).oauth_url = {
          status: 'OK',
          url: authUrl,
          note: 'You can open this URL in a browser to test the OAuth flow manually',
        };
      } else {
        (diagnostics.checks as Record<string, unknown>).oauth_url = {
          status: 'FAIL',
          error: 'Cannot generate URL — missing CLIENT_ID or REDIRECT_URI',
        };
      }
    } catch (urlErr: unknown) {
      (diagnostics.checks as Record<string, unknown>).oauth_url = {
        status: 'ERROR',
        error: urlErr instanceof Error ? urlErr.message : String(urlErr),
      };
    }

    // ── Check 5: Test Microsoft token endpoint reachability ──
    try {
      const tokenTest = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=test', // Will fail but proves connectivity
      });

      (diagnostics.checks as Record<string, unknown>).microsoft_reachable = {
        status: tokenTest.status === 400 ? 'OK (reachable, got expected 400)' : `HTTP ${tokenTest.status}`,
        note: 'A 400 response means Microsoft token endpoint is reachable',
      };
    } catch (fetchErr: unknown) {
      (diagnostics.checks as Record<string, unknown>).microsoft_reachable = {
        status: 'FAIL',
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        note: 'Cannot reach Microsoft — check CSP or network settings',
      };
    }

    // ── Check 6: Test the connect endpoint directly ──
    try {
      const connectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'}/api/auth/outlook/connect`;
      (diagnostics.checks as Record<string, unknown>).connect_endpoint = {
        url: connectUrl,
        note: 'POST this URL to initiate OAuth flow',
      };
    } catch { /* silent */ }

    // ── Summary ──
    const allEnvSet = !Object.values(envChecks).some(v => v === 'MISSING');
    diagnostics.summary = {
      env_vars_ok: allEnvSet,
      db_ok: !oaErr && !stErr,
      auth_ok: true,
      ready: allEnvSet && !oaErr && !stErr,
    };

    return NextResponse.json(diagnostics, { status: 200 });

  } catch (err: unknown) {
    diagnostics.fatal_error = err instanceof Error ? err.message : String(err);
    return NextResponse.json(diagnostics, { status: 500 });
  }
}
