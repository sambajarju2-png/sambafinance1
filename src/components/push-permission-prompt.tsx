'use client';

import { useEffect } from 'react';

/**
 * Auto-requests push notification permission once.
 * Triggers the native iOS/Android/browser permission dialog.
 * If granted, subscribes to push and enables in user_settings.
 * Runs once — stores flag in localStorage to never ask again.
 *
 * Mount in app layout: <PushPermissionPrompt />
 */
export default function PushPermissionPrompt() {
  useEffect(() => {
    // Only run in browser with push support
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    // Already granted or denied — nothing to do
    if (Notification.permission !== 'default') return;

    // Only ask once
    if (localStorage.getItem('pw-push-asked')) return;

    // Small delay so the page loads first (feels less aggressive)
    const timer = setTimeout(async () => {
      localStorage.setItem('pw-push-asked', '1');

      try {
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
          const reg = await navigator.serviceWorker.ready;
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) return;

          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey,
          });

          const json = sub.toJSON();

          // Save subscription to server
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: json.endpoint,
              p256dh: json.keys?.p256dh,
              auth_key: json.keys?.auth,
            }),
          });

          // Enable push in user settings
          await fetch('/api/settings/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notify_push_enabled: true }),
          });
        }
      } catch (err) {
        console.error('[PushPermissionPrompt]', err);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Renders nothing — purely a side-effect component
  return null;
}
