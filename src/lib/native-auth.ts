'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Native OAuth flow for Capacitor iOS/Android.
 * 
 * Flow:
 * 1. signInWithOAuth({ skipBrowserRedirect: true }) → stores PKCE verifier in cookies
 * 2. Opens returned URL in SFSafariViewController (native in-app browser)
 * 3. OAuth provider redirects to nl.paywatch.app://auth/callback?code=xxx
 * 4. iOS catches the custom URL scheme → fires appUrlOpen event
 * 5. handleOAuthCallback extracts the code → exchanges for session
 * 6. Closes browser → redirects to dashboard
 */

const NATIVE_CALLBACK_URL = 'nl.paywatch.app://auth/callback';

/**
 * Start the native OAuth flow.
 * Opens Google/Outlook auth in SFSafariViewController instead of the WebView.
 * 
 * @returns The auth URL if successfully generated, null on error
 */
export async function startNativeOAuth(
  provider: 'google' | 'azure'
): Promise<{ url: string | null; error: string | null }> {
  try {
    const supabase = createClient();

    const options: Record<string, unknown> = {
      redirectTo: NATIVE_CALLBACK_URL,
      skipBrowserRedirect: true,
    };

    // Google: request offline access for Gmail scanning later
    if (provider === 'google') {
      options.queryParams = {
        access_type: 'offline',
        prompt: 'consent',
      };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options,
    });

    if (error) {
      console.error('[NativeAuth] signInWithOAuth error:', error.message);
      return { url: null, error: error.message };
    }

    if (!data?.url) {
      return { url: null, error: 'No auth URL returned from Supabase' };
    }

    // Open in SFSafariViewController (iOS) or Chrome Custom Tab (Android)
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({
      url: data.url,
      presentationStyle: 'popover', // iOS: slide-up modal style
    });

    return { url: data.url, error: null };
  } catch (err) {
    console.error('[NativeAuth] startNativeOAuth failed:', err);
    return { url: null, error: 'Failed to start authentication' };
  }
}

/**
 * Handle the OAuth callback when the app is opened via deep link.
 * Extracts the authorization code, exchanges it for a session, and redirects.
 * 
 * Call this from the appUrlOpen listener in native-init.ts
 * 
 * @param url - The full callback URL (e.g., nl.paywatch.app://auth/callback?code=xxx)
 * @returns true if handled successfully, false otherwise
 */
export async function handleOAuthCallback(url: string): Promise<boolean> {
  try {
    // Only handle our auth callback
    if (!url.includes('auth/callback')) {
      return false;
    }

    console.log('[NativeAuth] Handling OAuth callback');

    // Extract the authorization code from the URL
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const errorParam = urlObj.searchParams.get('error');
    const errorDescription = urlObj.searchParams.get('error_description');

    // Close the in-app browser
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.close();
    } catch {
      // Browser might already be closed
    }

    if (errorParam) {
      console.error('[NativeAuth] OAuth error:', errorParam, errorDescription);
      window.location.href = `/auth/login?error=${encodeURIComponent(errorDescription || errorParam)}`;
      return true;
    }

    if (!code) {
      console.error('[NativeAuth] No authorization code in callback URL');
      window.location.href = '/auth/login?error=no_code';
      return true;
    }

    // Exchange the code for a session
    // The PKCE code verifier was stored in cookies when we called signInWithOAuth
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[NativeAuth] Token exchange failed:', error.message);
      window.location.href = `/auth/login?error=${encodeURIComponent(error.message)}`;
      return true;
    }

    console.log('[NativeAuth] Authentication successful — redirecting to dashboard');

    // Success haptic
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Success });
    } catch {}

    // Navigate to the app
    window.location.href = '/';
    return true;
  } catch (err) {
    console.error('[NativeAuth] handleOAuthCallback failed:', err);
    window.location.href = '/auth/login?error=callback_failed';
    return true;
  }
}
