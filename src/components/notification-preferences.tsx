'use client';

import { useState, useEffect } from 'react';
import { Mail, Bell, Loader2 } from 'lucide-react';

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState({ notify_email_welcome: true, notify_email_features: true, notify_email_digest: true, notify_push_enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) {
          const { profile } = await res.json();
          setPrefs({
            notify_email_welcome: profile.notify_email_welcome ?? true,
            notify_email_features: profile.notify_email_features ?? true,
            notify_email_digest: profile.notify_email_digest ?? true,
            notify_push_enabled: profile.notify_push_enabled ?? false,
          });
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function toggle(key: keyof typeof prefs) {
    const newVal = !prefs[key];
    setSaving(key);
    setPrefs((p) => ({ ...p, [key]: newVal }));
    try {
      await fetch('/api/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newVal }),
      });
    } catch {
      setPrefs((p) => ({ ...p, [key]: !newVal }));
    } finally { setSaving(null); }
  }

  if (loading) return <div className="skeleton h-[180px] rounded-card" />;

  const toggleItems: { key: keyof typeof prefs; icon: typeof Mail; label: string; desc: string }[] = [
    { key: 'notify_email_digest', icon: Mail, label: 'Wekelijks overzicht', desc: 'Ontvang elke week een samenvatting per e-mail' },
    { key: 'notify_email_welcome', icon: Mail, label: 'Welkomst e-mails', desc: 'Ontvang onboarding e-mails na registratie' },
    { key: 'notify_email_features', icon: Mail, label: 'Functie updates', desc: 'E-mails over nieuwe functies en tips' },
    { key: 'notify_push_enabled', icon: Bell, label: 'Push meldingen', desc: 'Ontvang herinneringen op je apparaat' },
  ];

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <p className="mb-3 text-[14px] font-semibold text-pw-text">E-mail & meldingen</p>
      <div className="space-y-3">
        {toggleItems.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
              <div>
                <p className="text-[13px] font-semibold text-pw-text">{item.label}</p>
                <p className="text-[10px] text-pw-muted">{item.desc}</p>
              </div>
            </div>
            <button onClick={() => toggle(item.key)} disabled={saving === item.key}
              className={`relative h-6 w-10 rounded-full transition-colors ${prefs[item.key] ? 'bg-pw-blue' : 'bg-pw-border'}`}>
              {saving === item.key ? (
                <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" strokeWidth={2} />
              ) : (
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${prefs[item.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
