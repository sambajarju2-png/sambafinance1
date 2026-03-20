'use client';

import { useState, useEffect } from 'react';
import { Mail, Loader2, Check, AlertTriangle } from 'lucide-react';

type EmailType = 'welcome' | 'features' | 'digest';
const ADMIN_EMAILS = ['sambajarju2@gmail.com', 'ayeitssamba@gmail.com', 'reiskenners@gmail.com'];

export default function TestEmailButtons() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [sending, setSending] = useState<EmailType | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) {
          const { profile } = await res.json();
          if (profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase())) setIsAdmin(true);
        }
      } catch {}
    }
    check();
  }, []);

  if (!isAdmin) return null;

  async function handleSend(type: EmailType) {
    setSending(type); setResult(null);
    try {
      const res = await fetch('/api/email/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) });
      const data = await res.json();
      setResult({ ok: data.success || !!data.id, message: data.success ? `${type} verzonden naar ${data.sent_to}` : data.error || 'Mislukt' });
    } catch { setResult({ ok: false, message: 'Netwerkfout' }); }
    finally { setSending(null); setTimeout(() => setResult(null), 5000); }
  }

  const emails: { type: EmailType; label: string; desc: string }[] = [
    { type: 'welcome', label: 'Welkomst e-mail', desc: 'Dag 0 — Het verhaal' },
    { type: 'features', label: 'Functies e-mail', desc: 'Dag 2 — Features' },
    { type: 'digest', label: 'Wekelijks overzicht', desc: 'Samenvatting' },
  ];

  return (
    <div className="rounded-card border border-dashed border-pw-purple/30 bg-pw-purple/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4 text-pw-purple" strokeWidth={1.5} />
        <p className="text-[13px] font-semibold text-pw-purple">Test e-mails (admin)</p>
      </div>
      <div className="space-y-2">
        {emails.map((e) => (
          <button key={e.type} onClick={() => handleSend(e.type)} disabled={sending !== null}
            className="btn-press flex w-full items-center gap-3 rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-left transition-colors hover:bg-pw-bg disabled:opacity-50">
            <div className="flex-1"><p className="text-[12px] font-semibold text-pw-text">{e.label}</p><p className="text-[10px] text-pw-muted">{e.desc}</p></div>
            {sending === e.type && <Loader2 className="h-3.5 w-3.5 animate-spin text-pw-purple" strokeWidth={2} />}
          </button>
        ))}
      </div>
      {result && (
        <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${result.ok ? 'text-pw-green' : 'text-pw-red'}`}>
          {result.ok ? <Check className="h-3 w-3" strokeWidth={2} /> : <AlertTriangle className="h-3 w-3" strokeWidth={2} />}
          {result.message}
        </div>
      )}
    </div>
  );
}
