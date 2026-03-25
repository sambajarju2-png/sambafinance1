/**
 * POST /api/auth/outlook/connect
 * 
 * Initiates the Microsoft OAuth2 flow for Outlook/Hotmail email access.
 * 
 * File: src/app/api/auth/outlook/connect/route.ts
 */

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth';
import { getMicrosoftAuthUrl } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

export async function POST() {
  // Step-by-step with individual try/catch so we know EXACTLY where it fails
  
  // Step 1: Auth
  let userId: string | null = null;
  try {
    userId = await getAuthUserId();
  } catch (e: unknown) {
    console.error('[Outlook Connect] getAuthUserId threw:', e);
    return NextResponse.json({ 
      error: 'Auth fout', 
      debug: e instanceof Error ? e.message : String(e),
      step: 'getAuthUserId'
    }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  // Step 2: Env vars
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('[Outlook Connect] Missing env vars:', { 
      clientId: !!clientId, clientSecret: !!clientSecret, redirectUri: !!redirectUri 
    });
    return NextResponse.json({ 
      error: 'Outlook integratie is nog niet geconfigureerd',
      step: 'env_vars'
    }, { status: 500 });
  }

  // Step 3: Generate state
  let state: string;
  try {
    state = randomBytes(32).toString('hex');
  } catch (e: unknown) {
    console.error('[Outlook Connect] randomBytes threw:', e);
    return NextResponse.json({ 
      error: 'Kon state niet genereren', 
      debug: e instanceof Error ? e.message : String(e),
      step: 'randomBytes'
    }, { status: 500 });
  }

  // Step 4: Create service client
  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch (e: unknown) {
    console.error('[Outlook Connect] createServiceRoleClient threw:', e);
    return NextResponse.json({ 
      error: 'Database client fout', 
      debug: e instanceof Error ? e.message : String(e),
      step: 'createServiceRoleClient'
    }, { status: 500 });
  }

  // Step 5: Cleanup expired states (non-critical)
  try {
    await supabase.rpc('cleanup_expired_outlook_oauth_states');
  } catch {
    // Non-critical — just continue
  }

  // Step 6: Insert state
  try {
    const { error: stateError } = await supabase
      .from('outlook_oauth_states')
      .insert({
        state,
        user_id: userId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      console.error('[Outlook Connect] State insert failed:', stateError);
      return NextResponse.json({ 
        error: 'Kon OAuth sessie niet starten', 
        debug: stateError.message,
        code: stateError.code,
        step: 'insert_state'
      }, { status: 500 });
    }
  } catch (e: unknown) {
    console.error('[Outlook Connect] State insert threw:', e);
    return NextResponse.json({ 
      error: 'Database fout bij state insert', 
      debug: e instanceof Error ? e.message : String(e),
      step: 'insert_state_catch'
    }, { status: 500 });
  }

  // Step 7: Generate auth URL
  let authUrl: string;
  try {
    authUrl = getMicrosoftAuthUrl(state);
  } catch (e: unknown) {
    console.error('[Outlook Connect] getMicrosoftAuthUrl threw:', e);
    return NextResponse.json({ 
      error: 'Kon OAuth URL niet maken', 
      debug: e instanceof Error ? e.message : String(e),
      step: 'getMicrosoftAuthUrl'
    }, { status: 500 });
  }

  return NextResponse.json({ url: authUrl });
}
