'use client';

import { useState } from 'react';
import { Bell, Loader2, Check, AlertTriangle } from 'lucide-react';

export default function TestNotification() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleTest() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: `Verzonden: "${data.message}"` });
      } else {
        setResult({ ok: false, message: data.error || 'Mislukt' });
      }
    } catch {
      setResult({ ok: false, message: 'Netwerkfout' });
    } finally {
      setSending(false);
      setTimeout(() => setResult(null), 5000);
    }
  }

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <p className="mb-2 text-[14px] font-semibold text-pw-text">Test melding</p>
      <p className="mb-3 text-[11px] text-pw-muted">
        Stuur een testmelding naar dit apparaat om te zien hoe meldingen eruitzien.
      </p>
      <button
        onClick={handleTest}
        disabled={sending}
        className="btn-press flex items-center gap-2 rounded-button bg-pw-purple px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <Bell className="h-3 w-3" strokeWidth={2} />}
        Verstuur testmelding
      </button>
      {result && (
        <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${result.ok ? 'text-pw-green' : 'text-pw-red'}`}>
          {result.ok ? <Check className="h-3 w-3" strokeWidth={2} /> : <AlertTriangle className="h-3 w-3" strokeWidth={2} />}
          {result.message}
        </div>
      )}
    </div>
  );
}
