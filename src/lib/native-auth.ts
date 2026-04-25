'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Native OAuth flow for Capacitor iOS/Android.
 * 
 * Complete flow:
 * 1. signInWithOAuth({ skipBrowserRedirect: true }) → stores PKCE verifier in cookies
 * 2. Opens returned URL in SFSafariViewController (native in-app browser)
 * 3. User authenticates with Google/Microsoft
 * 4. Provider redirects to Supabase → Supabase redirects to nl.paywatch.app://auth/callback?code=xxx
 * 5. iOS catches the custom URL scheme → fires appUrlOpen event (via @capacitor/app)
 * 6. handleOAuthCallback extracts the code → exchanges for Supabase session
 * 7. Closes SFSafariViewController → navigates to dashboard
 * 
 * Google Console does NOT need any changes — Google only sees Supabase's callback URL.
 * Only Supabase Dashboard needs nl.paywatch.app://auth/callback in Redirect URLs.
 */

const NATIVE_CALLBACK_URL = 'nl.paywatch.app://auth/callback';

/**
 * Extract a query parameter from a URL string.
 * Uses regex instead of new URL() because JavaScript's URL parser
 * can be unreliable with custom URL schemes like nl.paywatch.app://
 */
function getParam(url: string, name: string): string | null {
  const match = url.match(new RegExp(`[?&]${name}=([^&]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Start the native OAuth flow.
 * Opens Google/Outlook auth in SFSafariViewController instead of the WebView.
 */
export async function startNativeOAuth(
  provider: 'google' | 'azure'
): Promise<{ url: string | null; error: string | null }> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: NATIVE_CALLBACK_URL,
        skipBrowserRedirect: true,
        ...(provider === 'google' && {
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }),
      },
    });

    if (error) {
      console.error('[NativeAuth] signInWithOAuth error:', error.message);
      return { url: null, error: error.message };
    }

    if (!data?.url) {
      return { url: null, error: 'No auth URL returned from Supabase' };
    }

    const { Browser } = await import('@capacitor/browser');

    // Listen for user cancellation (taps "Done" without completing auth)
    // Fires a custom event so the auth form can reset its loading state
    const cancelListener = await Browser.addListener('browserFinished', () => {
      // Give 1.5 seconds for the appUrlOpen callback to process first
      // If the user completed auth, window.location will change before this fires
      setTimeout(() => {
        if (window.location.pathname.startsWith('/auth')) {
          console.log('[NativeAuth] Browser closed without completing auth');
          window.dispatchEvent(new CustomEvent('paywatch:oauth-cancelled'));
        }
      }, 1500);
      // Clean up — only fire once
      cancelListener.remove();
    });

    // Open in SFSafariViewController (iOS) / Chrome Custom Tab (Android)
    await Browser.open({ url: data.url });

    return { url: data.url, error: null };
  } catch (err) {
    console.error('[NativeAuth] startNativeOAuth failed:', err);
    return { url: null, error: 'Failed to start authentication' };
  }
}

/**
 * Handle the OAuth callback when the app is opened via deep link.
 * Called from the appUrlOpen listener in native-init.ts.
 * 
 * @param url - The full callback URL (nl.paywatch.app://auth/callback?code=xxx)
 * @returns true if handled, false if not an auth callback
 */
export async function handleOAuthCallback(url: string): Promise<boolean> {
  try {
    // Only handle our auth callback
    if (!url.includes('auth/callback')) {
      return false;
    }

    console.log('[NativeAuth] Handling OAuth callback:', url.split('?')[0]);

    // Extract parameters using regex (safer than new URL() for custom schemes)
    const code = getParam(url, 'code');
    const errorParam = getParam(url, 'error');
    const errorDescription = getParam(url, 'error_description');

    // Close SFSafariViewController immediately
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.close();
    } catch {
      // Browser might already be closed
    }

    // Handle OAuth errors from provider
    if (errorParam) {
      console.error('[NativeAuth] OAuth provider error:', errorParam, errorDescription);
      window.location.href = `/auth/login?error=${encodeURIComponent(errorDescription || errorParam)}`;
      return true;
    }

    // Verify we got an authorization code
    if (!code) {
      console.error('[NativeAuth] No authorization code in callback URL');
      window.location.href = '/auth/login?error=no_code';
      return true;
    }

    // Exchange the authorization code for a Supabase session.
    // The PKCE code verifier was stored in cookies by signInWithOAuth
    // on the app.paywatch.app domain (WebView never navigated away).
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[NativeAuth] Session exchange failed:', error.message);
      window.location.href = `/auth/login?error=${encodeURIComponent(error.message)}`;
      return true;
    }

    console.log('[NativeAuth] Session established — redirecting to app');

    // Success haptic
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Success });
    } catch {}

    // Navigate to the app — full page load to pick up the new session
    window.location.href = '/';
    return true;
  } catch (err) {
    console.error('[NativeAuth] handleOAuthCallback failed:', err);
    window.location.href = '/auth/login?error=callback_failed';
    return true;
  }
}
