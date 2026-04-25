'use client';

import { useEffect } from 'react';

/**
 * Initialize native Capacitor plugins when running in the native shell.
 * Call this once in the root layout or app shell.
 * 
 * Sets up:
 * - Splash screen dismissal
 * - Status bar styling
 * - Keyboard behavior
 * - App lifecycle (resume/pause)
 * - Push notification registration
 * - OAuth deep link handler (appUrlOpen)
 * - External link interception (→ SFSafariViewController)
 */
export function useNativeInit() {
  useEffect(() => {
    async function init() {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const platform = Capacitor.getPlatform();

        // ─── Splash screen ────────────────────────────────────
        // Hide after page has rendered — prevents iOS watchdog SIGKILL
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen');
          await SplashScreen.hide({ fadeOutDuration: 300 });
        } catch {}

        // ─── Status bar ───────────────────────────────────────
        try {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          await StatusBar.setStyle({ style: Style.Dark });
          if (platform === 'android') {
            await StatusBar.setBackgroundColor({ color: '#0A2540' });
          }
        } catch {}

        // ─── Keyboard ─────────────────────────────────────────
        try {
          const { Keyboard } = await import('@capacitor/keyboard');
          Keyboard.addListener('keyboardWillShow', (info) => {
            document.body.classList.add('keyboard-open');
            document.documentElement.style.setProperty(
              '--keyboard-height', `${info.keyboardHeight}px`
            );
          });
          Keyboard.addListener('keyboardWillHide', () => {
            document.body.classList.remove('keyboard-open');
            document.documentElement.style.setProperty('--keyboard-height', '0px');
          });
        } catch {}

        // ─── App lifecycle ────────────────────────────────────
        try {
          const { App } = await import('@capacitor/app');

          // Refresh data when app returns to foreground
          App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
              window.dispatchEvent(new CustomEvent('paywatch:resume'));
            }
          });

          // Android back button
          App.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
              window.history.back();
            } else {
              App.minimizeApp();
            }
          });

          // ─── Deep link handler (OAuth callback) ─────────────
          // Fires when the app is opened via nl.paywatch.app:// URL scheme
          App.addListener('appUrlOpen', async ({ url }) => {
            console.log('[NativeInit] appUrlOpen:', url);

            // Handle OAuth callbacks
            if (url.includes('auth/callback')) {
              try {
                const { handleOAuthCallback } = await import('@/lib/native-auth');
                await handleOAuthCallback(url);
              } catch (err) {
                console.error('[NativeInit] OAuth callback error:', err);
                window.location.href = '/auth/login?error=callback_failed';
              }
              return;
            }

            // Handle other deep links — navigate within the app
            try {
              const path = new URL(url).pathname;
              if (path && path !== '/') {
                window.location.href = path;
              }
            } catch {
              // Invalid URL, ignore
            }
          });

        } catch {}

        // ─── Push notifications ───────────────────────────────
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          
          const permResult = await PushNotifications.checkPermissions();
          if (permResult.receive !== 'granted') {
            await PushNotifications.requestPermissions();
          }

          await PushNotifications.register();

          PushNotifications.addListener('registration', (token) => {
            console.log('[NativePush] Token:', token.value);
            fetch('/api/push/native-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: token.value, platform }),
            }).catch(() => {});
          });

          PushNotifications.addListener('registrationError', (error) => {
            console.error('[NativePush] Registration error:', error);
          });

          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[NativePush] Received:', notification);
          });

          PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[NativePush] Tapped:', action);
            const data = action.notification.data;
            if (data?.url) {
              window.location.href = data.url;
            }
          });
        } catch {}

        // ─── External link interception ───────────────────────
        setupExternalLinkInterception();

        console.log('[PayWatch] Native init complete — platform:', platform);
      } catch {
        // Not in Capacitor — web mode, skip native init
      }
    }

    init();
  }, []);
}

/**
 * Intercept clicks on external links and open them in
 * SFSafariViewController (iOS) / Chrome Custom Tab (Android)
 * instead of loading inside the WebView.
 * 
 * Rules:
 * - Internal links (paywatch.app) → WebView handles normally
 * - External links / target="_blank" → SFSafariViewController
 * - tel: / mailto: → system handler
 */
function setupExternalLinkInterception() {
  document.addEventListener('click', async (e) => {
    const link = (e.target as HTMLElement).closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Skip hash links and javascript: URIs
    if (href.startsWith('#') || href.startsWith('javascript:')) return;

    // Let tel: and mailto: pass through — iOS handles them natively
    if (href.startsWith('tel:') || href.startsWith('mailto:')) return;

    // Check if external
    const isExternal = !href.includes('paywatch.app') && (
      href.startsWith('http://') || href.startsWith('https://')
    );
    const isBlankTarget = link.target === '_blank';

    if (isExternal || isBlankTarget) {
      e.preventDefault();
      e.stopPropagation();

      try {
        const { Browser } = await import('@capacitor/browser');
        const fullUrl = href.startsWith('http') ? href : `https://${href}`;
        await Browser.open({ url: fullUrl });
      } catch {
        // Fallback: open in WebView
        window.open(href, '_blank');
      }
    }
  }, true); // Capture phase — intercept before React handlers
}
