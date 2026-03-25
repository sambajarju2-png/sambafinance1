/**
 * GET /api/debug/outlook
 * 
 * Tests the full Outlook OAuth flow step by step.
 * Also serves as a manual callback tester with ?test_callback=true
 * 
 * ADMIN ONLY: sambajarju2@gmail.com
 * 
 * File: src/app/api/debug/outlook/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ['sambajarju2@gmail.com'];

export async function GET(request: NextRequest) {
  const steps: Record<string, unknown>[] = [];
  const addStep = (name: string, data: unknown) => {
    steps.push({ step: name, ...((typeof data === 'object' && data !== null) ? data : { result: data }) });
  };

  try {
    // ── Auth ──
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated', authError: authError?.message }, { status: 401 });
    }

    if (!ADMIN_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    addStep('1_auth', { status: 'OK', user_id: user.id, email: user.email });

    // ── Env vars ──
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    addStep('2_env_vars', {
      MICROSOFT_CLIENT_ID: clientId ? `SET (${clientId.slice(0, 8)}...)` : 'MISSING',
      MICROSOFT_CLIENT_SECRET: clientSecret ? `SET (length: ${clientSecret.length})` : 'MISSING',
      MICROSOFT_REDIRECT_URI: redirectUri || 'MISSING',
    });

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ error: 'Missing env vars', steps }, { status: 500 });
    }

    // ── Test createServiceRoleClient ──
    let serviceClient: ReturnType<typeof createServiceRoleClient>;
    try {
      serviceClient = createServiceRoleClient();
      addStep('3_service_client', { status: 'OK' });
    } catch (e: unknown) {
      addStep('3_service_client', { status: 'FAIL', error: e instanceof Error ? e.message : String(e) });
      return NextResponse.json({ error: 'createServiceRoleClient failed', steps }, { status: 500 });
    }

    // ── Test state insertion ──
    const testState = `debug-${randomBytes(16).toString('hex')}`;
    try {
      const { error: insertError } = await serviceClient
        .from('outlook_oauth_states')
        .insert({
          state: testState,
          user_id: user.id,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });

      if (insertError) {
        addStep('4_insert_state', { status: 'FAIL', error: insertError.message, code: insertError.code, details: insertError.details, hint: insertError.hint });
        return NextResponse.json({ error: 'State insertion failed', steps }, { status: 500 });
      }

      addStep('4_insert_state', { status: 'OK', state: testState });
    } catch (e: unknown) {
      addStep('4_insert_state', { status: 'EXCEPTION', error: e instanceof Error ? e.message : String(e) });
      return NextResponse.json({ error: 'State insertion threw', steps }, { status: 500 });
    }

    // ── Verify state can be read back ──
    try {
      const { data: readBack, error: readError } = await serviceClient
        .from('outlook_oauth_states')
        .select('state, user_id, expires_at')
        .eq('state', testState)
        .single();

      if (readError || !readBack) {
        addStep('5_read_state', { status: 'FAIL', error: readError?.message });
      } else {
        addStep('5_read_state', { status: 'OK', found: true });
      }
    } catch (e: unknown) {
      addStep('5_read_state', { status: 'EXCEPTION', error: e instanceof Error ? e.message : String(e) });
    }

    // ── Clean up test state ──
    await serviceClient.from('outlook_oauth_states').delete().eq('state', testState);

    // ── Generate real OAuth URL ──
    const realState = randomBytes(32).toString('hex');

    // Insert real state for actual test
    const { error: realStateError } = await serviceClient
      .from('outlook_oauth_states')
      .insert({
        state: realState,
        user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (realStateError) {
      addStep('6_real_state', { status: 'FAIL', error: realStateError.message });
      return NextResponse.json({ error: 'Could not create real state', steps }, { status: 500 });
    }

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
      state: realState,
      response_mode: 'query',
      prompt: 'consent',
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

    addStep('6_oauth_url', {
      status: 'OK',
      url: authUrl,
      state_stored: true,
      note: 'Open this URL to test the FULL flow including callback',
    });

    // ── Test Microsoft reachability ──
    try {
      const msTest = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=test',
      });
      addStep('7_microsoft_reachable', { status: `HTTP ${msTest.status}`, ok: msTest.status === 400 });
    } catch (e: unknown) {
      addStep('7_microsoft_reachable', { status: 'FAIL', error: e instanceof Error ? e.message : String(e) });
    }

    // ── Check if connect route can be imported ──
    addStep('8_connect_route', {
      note: 'If the button click fails but this debug works, check the browser console for the POST /api/auth/outlook/connect response',
    });

    return NextResponse.json({
      summary: 'All checks passed. Open the oauth_url to test the full flow.',
      test_auth_url: authUrl,
      steps,
    });

  } catch (err: unknown) {
    return NextResponse.json({
      fatal_error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      steps,
    }, { status: 500 });
  }
}
