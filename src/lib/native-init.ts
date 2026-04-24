'use client';

import { useEffect } from 'react';

/**
 * Initialize native Capacitor plugins when running in the native shell.
 * Call this once in the root layout or app shell.
 * 
 * Sets up:
 * - Status bar styling
 * - Keyboard behavior
 * - App lifecycle (resume/pause)
 * - Push notification registration
 */
export function useNativeInit() {
  useEffect(() => {
    async function init() {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        // Status bar — match PayWatch navy theme
        try {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          await StatusBar.setStyle({ style: Style.Dark });
          if (Capacitor.getPlatform() === 'android') {
            await StatusBar.setBackgroundColor({ color: '#0A2540' });
          }
        } catch {}

        // Keyboard — handle resize on input focus
        try {
          const { Keyboard } = await import('@capacitor/keyboard');
          Keyboard.addListener('keyboardWillShow', () => {
            document.body.classList.add('keyboard-open');
          });
          Keyboard.addListener('keyboardWillHide', () => {
            document.body.classList.remove('keyboard-open');
          });
        } catch {}

        // App lifecycle — refresh data on resume
        try {
          const { App } = await import('@capacitor/app');
          App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
              // Trigger a re-fetch when app returns to foreground
              window.dispatchEvent(new CustomEvent('paywatch:resume'));
            }
          });

          // Handle back button on Android
          App.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
              window.history.back();
            } else {
              App.minimizeApp();
            }
          });
        } catch {}

        // Push notifications — register for native push
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          
          const permResult = await PushNotifications.checkPermissions();
          if (permResult.receive !== 'granted') {
            await PushNotifications.requestPermissions();
          }

          await PushNotifications.register();

          // Handle token received — send to backend
          PushNotifications.addListener('registration', (token) => {
            console.log('[Native Push] Token:', token.value);
            // Save native push token to backend
            fetch('/api/push/native-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
            }).catch(() => {});
          });

          PushNotifications.addListener('registrationError', (error) => {
            console.error('[Native Push] Registration error:', error);
          });

          // Handle notification received while app is open
          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[Native Push] Received:', notification);
          });

          // Handle notification tapped
          PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[Native Push] Tapped:', action);
            const data = action.notification.data;
            if (data?.url) {
              window.location.href = data.url;
            }
          });
        } catch {}

        console.log('[PayWatch] Native init complete — platform:', Capacitor.getPlatform());
      } catch {
        // Not in Capacitor — web mode, skip native init
      }
    }

    init();
  }, []);
}
