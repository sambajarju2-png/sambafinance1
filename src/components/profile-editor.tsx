'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { User, Loader2, Check } from 'lucide-react';

export default function ProfileEditor() {
  const t = useTranslations('profile');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) {
          const { profile } = await res.json();
          setFirstName(profile.first_name || '');
          setLastName(profile.last_name || '');
          setDob(profile.date_of_birth || '');
          setEmail(profile.email || '');
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, date_of_birth: dob || null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  if (loading) return <div className="skeleton h-[200px] rounded-card" />;

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <User className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
        <p className="text-[14px] font-semibold text-pw-text">{t('title')}</p>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-pw-muted">{t('firstName')}</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-input border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-pw-muted">{t('lastName')}</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-input border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-pw-muted">{t('dateOfBirth')}</label>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
            className="w-full rounded-input border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none" />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-pw-muted">{t('email')}</label>
          <input type="email" value={email} disabled
            className="w-full rounded-input border border-pw-border bg-pw-border/20 px-3 py-2 text-[13px] text-pw-muted" />
          <p className="mt-1 text-[10px] text-pw-muted">{t('emailHint')}</p>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="btn-press flex items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> :
           saved ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : null}
          {saved ? t('saved') : t('save')}
        </button>
      </div>
    </div>
  );
}
