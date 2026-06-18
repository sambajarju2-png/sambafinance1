'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { localeFromCookie, pick } from '@/lib/i18n-pick';

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

  const lang = localeFromCookie();

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
              {pick(lang, { nl: 'Pushmeldingen', en: 'Push notifications', pl: 'Powiadomienia push', tr: 'Push bildirimleri' })}
            </p>
            <p className="text-[11px] text-pw-muted">
              {status === 'granted'
                ? pick(lang, { nl: 'Je ontvangt herinneringen voor vervaldatums', en: 'You receive reminders for due dates', pl: 'Otrzymujesz przypomnienia o terminach płatności', tr: 'Son ödeme tarihleri için hatırlatmalar alıyorsun' })
                : status === 'denied'
                  ? (isNative
                      ? pick(lang, { nl: 'Open Instellingen → Meldingen → PayWatch', en: 'Open Settings → Notifications → PayWatch', pl: 'Otwórz Ustawienia → Powiadomienia → PayWatch', tr: 'Ayarlar → Bildirimler → PayWatch yolunu aç' })
                      : pick(lang, { nl: 'Meldingen geblokkeerd in je browser', en: 'Notifications blocked in your browser', pl: 'Powiadomienia zablokowane w przeglądarce', tr: 'Bildirimler tarayıcında engellendi' }))
                  : pick(lang, { nl: 'Ontvang herinneringen voor vervaldatums', en: 'Receive reminders for due dates', pl: 'Otrzymuj przypomnienia o terminach płatności', tr: 'Son ödeme tarihleri için hatırlatma al' })}
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
                ? pick(lang, { nl: 'Uitschakelen', en: 'Disable', pl: 'Wyłącz', tr: 'Kapat' })
                : pick(lang, { nl: 'Inschakelen', en: 'Enable', pl: 'Włącz', tr: 'Aç' })}
          </button>
        )}
      </div>
    </div>
  );
}
