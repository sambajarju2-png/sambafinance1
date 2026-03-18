'use client';

import { useState } from 'react';
import { Mail, Loader2, Check, AlertTriangle } from 'lucide-react';

type EmailType = 'welcome' | 'features' | 'digest';

export default function TestEmailButtons() {
  const [sending, setSending] = useState<EmailType | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string; type: string } | null>(null);

  async function handleSend(type: EmailType) {
    setSending(type);
    setResult(null);
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.success || data.id) {
        setResult({ ok: true, message: `${type} e-mail verzonden naar ${data.sent_to}`, type });
      } else {
        setResult({ ok: false, message: data.error || 'Mislukt', type });
      }
    } catch {
      setResult({ ok: false, message: 'Netwerkfout', type: '' });
    } finally {
      setSending(null);
      setTimeout(() => setResult(null), 6000);
    }
  }

  const emails: { type: EmailType; label: string; desc: string; emoji: string }[] = [
    { type: 'welcome', label: 'Welkomst e-mail', desc: 'Dag 0 — Het verhaal van PayWatch', emoji: '👋' },
    { type: 'features', label: 'Functies e-mail', desc: 'Dag 2 — Alle features uitgelegd', emoji: '✨' },
    { type: 'digest', label: 'Wekelijks overzicht', desc: 'Je rekeningen samengevat', emoji: '📊' },
  ];

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
        <p className="text-[14px] font-semibold text-pw-text">Test e-mails</p>
      </div>
      <p className="mb-3 text-[11px] text-pw-muted">Stuur test e-mails naar je eigen adres om te zien hoe ze eruitzien.</p>

      <div className="space-y-2">
        {emails.map((e) => (
          <button key={e.type} onClick={() => handleSend(e.type)} disabled={sending !== null}
            className="btn-press flex w-full items-center gap-3 rounded-input border border-pw-border px-3 py-2.5 text-left transition-colors hover:bg-pw-bg disabled:opacity-50">
            <span className="text-[18px]">{e.emoji}</span>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-pw-text">{e.label}</p>
              <p className="text-[10px] text-pw-muted">{e.desc}</p>
            </div>
            {sending === e.type && <Loader2 className="h-3.5 w-3.5 animate-spin text-pw-blue" strokeWidth={2} />}
          </button>
        ))}
      </div>

      {result && (
        <div className={`mt-3 flex items-center gap-1.5 text-[11px] font-semibold ${result.ok ? 'text-pw-green' : 'text-pw-red'}`}>
          {result.ok ? <Check className="h-3 w-3" strokeWidth={2} /> : <AlertTriangle className="h-3 w-3" strokeWidth={2} />}
          {result.message}
        </div>
      )}
    </div>
  );
}
