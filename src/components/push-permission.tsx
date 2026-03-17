'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';

export default function PushPermission() {
  const [status, setStatus] = useState<'loading' | 'unsupported' | 'denied' | 'granted' | 'prompt'>('loading');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) { setStatus('unsupported'); return; }
    setStatus(Notification.permission as 'denied' | 'granted' | 'prompt');
  }, []);

  async function handleEnable() {
    setSaving(true);
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission as 'denied' | 'granted' | 'prompt');
      if (permission === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) { setSaving(false); return; }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(vapidKey) });
        const json = sub.toJSON();
        await fetch('/api/push/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth_key: json.keys?.auth }),
        });
      }
    } catch (err) { console.error('Push error:', err); } finally { setSaving(false); }
  }

  async function handleDisable() {
    setSaving(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setStatus('prompt');
    } catch (err) { console.error('Push disable error:', err); } finally { setSaving(false); }
  }

  if (status === 'loading' || status === 'unsupported') return null;

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status === 'granted' ? <Bell className="h-5 w-5 text-pw-green" strokeWidth={1.5} /> : <BellOff className="h-5 w-5 text-pw-muted" strokeWidth={1.5} />}
          <div>
            <p className="text-[14px] font-semibold text-pw-text">Pushmeldingen</p>
            <p className="text-[11px] text-pw-muted">
              {status === 'granted' ? 'Je ontvangt herinneringen voor vervaldatums' : status === 'denied' ? 'Meldingen geblokkeerd in je browser' : 'Ontvang herinneringen voor vervaldatums'}
            </p>
          </div>
        </div>
        {status !== 'denied' && (
          <button onClick={status === 'granted' ? handleDisable : handleEnable} disabled={saving}
            className={`btn-press rounded-button px-3 py-1.5 text-[12px] font-semibold ${status === 'granted' ? 'border border-pw-border text-pw-muted' : 'bg-pw-blue text-white'}`}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : status === 'granted' ? 'Uitschakelen' : 'Inschakelen'}
          </button>
        )}
      </div>
    </div>
  );
}

function urlB64(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
