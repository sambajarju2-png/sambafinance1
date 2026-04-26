'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';

type Status = 'loading' | 'unsupported' | 'denied' | 'granted' | 'prompt';

export default function PushPermission() {
  const [status, setStatus] = useState<Status>('loading');
  const [isNative, setIsNative] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function init() {
      // Detect native
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          setIsNative(true);
          const { PushNotifications } = await import('@capacitor/push-notifications');
          const perm = await PushNotifications.checkPermissions();
          if (perm.receive === 'granted') setStatus('granted');
          else if (perm.receive === 'denied') setStatus('denied');
          else setStatus('prompt');
          return;
        }
      } catch {}

      // Web fallback
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        setStatus('unsupported');
        return;
      }
      setStatus(Notification.permission as Status);
    }
    init();
  }, []);

  async function handleEnable() {
    setSaving(true);
    try {
      if (isNative) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') {
          await PushNotifications.register();
          setStatus('granted');
          await fetch('/api/settings/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notify_push_enabled: true }),
          });
        } else {
          setStatus('denied');
        }
      } else {
        const permission = await Notification.requestPermission();
        setStatus(permission as Status);
        if (permission === 'granted') {
          const reg = await navigator.serviceWorker.ready;
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) { setSaving(false); return; }
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
      console.error('Push error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    setSaving(true);
    try {
      if (isNative) {
        // Don't set to 'denied' — that's only for iOS Settings denial
        // Set to 'prompt' so user can tap Inschakelen again
        setStatus('prompt');
        await fetch('/api/settings/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notify_push_enabled: false }),
        });
      } else {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setStatus('prompt');
      }
    } catch (err) {
      console.error('Push disable error:', err);
    } finally {
      setSaving(false);
    }
  }

  const isNl = typeof document !== 'undefined'
    ? (document.cookie.match(/paywatch-locale=(nl|en)/)?.[1] || 'nl') === 'nl'
    : true;

  if (status === 'loading' || status === 'unsupported') return null;

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status === 'granted'
            ? <Bell className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
            : <BellOff className="h-5 w-5 text-pw-muted" strokeWidth={1.5} />
          }
          <div>
            <p className="text-[14px] font-semibold text-pw-text">
              {isNl ? 'Pushmeldingen' : 'Push notifications'}
            </p>
            <p className="text-[11px] text-pw-muted">
              {status === 'granted'
                ? (isNl ? 'Je ontvangt herinneringen voor vervaldatums' : 'You receive reminders for due dates')
                : status === 'denied'
                  ? (isNative
                      ? (isNl ? 'Open Instellingen → Meldingen → PayWatch' : 'Open Settings → Notifications → PayWatch')
                      : (isNl ? 'Meldingen geblokkeerd in je browser' : 'Notifications blocked in your browser'))
                  : (isNl ? 'Ontvang herinneringen voor vervaldatums' : 'Receive reminders for due dates')}
            </p>
          </div>
        </div>
        {status !== 'denied' && (
          <button
            onClick={status === 'granted' ? handleDisable : handleEnable}
            disabled={saving}
            className={`btn-press rounded-button px-3 py-1.5 text-[12px] font-semibold ${
              status === 'granted'
                ? 'border border-pw-border text-pw-muted'
                : 'bg-pw-blue text-white'
            }`}
          >
            {saving
              ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
              : status === 'granted'
                ? (isNl ? 'Uitschakelen' : 'Disable')
                : (isNl ? 'Inschakelen' : 'Enable')}
          </button>
        )}
      </div>
    </div>
  );
}
