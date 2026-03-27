'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';

/**
 * Floating banner that prompts user to enable push notifications.
 * Tap "Enable" → triggers the native iOS/Android/browser permission dialog.
 * Shows once 1.5s after first dashboard load. Dismissed permanently on close or grant.
 *
 * Why a banner? iOS PWAs require a user gesture (button tap) to trigger
 * Notification.requestPermission(). Auto-triggering is silently blocked.
 */
export default function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem('pw-push-asked')) return;

    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  function handleDismiss() {
    localStorage.setItem('pw-push-asked', '1');
    setVisible(false);
  }

  async function handleEnable() {
    setEnabling(true);
    localStorage.setItem('pw-push-asked', '1');

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (vapidKey) {
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey,
          });
          const json = sub.toJSON();

          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: json.endpoint,
              p256dh: json.keys?.p256dh,
              auth_key: json.keys?.auth,
            }),
          });

          await fetch('/api/settings/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notify_push_enabled: true }),
          });
        }
      }
    } catch (err) {
      console.error('[PushBanner]', err);
    } finally {
      setVisible(false);
    }
  }

  if (!visible) return null;

  const isNl = typeof document !== 'undefined'
    ? (document.cookie.match(/paywatch-locale=(nl|en)/)?.[1] || 'nl') === 'nl'
    : true;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50">
      <style>{`
        @keyframes pw-slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pw-banner-enter { animation: pw-slide-up 300ms ease-out both; }
      `}</style>

      <div className="pw-banner-enter relative mx-auto max-w-[400px] overflow-hidden rounded-2xl border border-pw-border bg-pw-surface shadow-lg">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-pw-muted hover:bg-pw-bg transition-colors"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-pw-blue/10">
              <Bell className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
            </div>
            <div className="flex-1 pr-4">
              <p className="text-[14px] font-semibold text-pw-navy">
                {isNl ? 'Meldingen inschakelen' : 'Enable notifications'}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-pw-muted">
                {isNl
                  ? 'Ontvang een melding als een rekening bijna vervalt of als je scan klaar is.'
                  : 'Get notified when a bill is almost due or when your scan is complete.'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleEnable}
              disabled={enabling}
              className="btn-press flex-1 rounded-button bg-pw-blue px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50 transition-transform active:scale-[0.97]"
            >
              {enabling
                ? (isNl ? 'Even geduld...' : 'One moment...')
                : (isNl ? 'Inschakelen' : 'Enable')}
            </button>
            <button
              onClick={handleDismiss}
              className="btn-press rounded-button border border-pw-border px-4 py-2 text-[13px] font-semibold text-pw-muted transition-transform active:scale-[0.97]"
            >
              {isNl ? 'Later' : 'Later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
