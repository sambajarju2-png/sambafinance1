'use client';

import { useState } from 'react';
import { Moon, Sun, Loader2 } from 'lucide-react';

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') return document.documentElement.classList.contains('dark');
    return false;
  });
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const newVal = !isDark;
    setSaving(true);
    if (newVal) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    setIsDark(newVal);

    try {
      await fetch('/api/settings/dark-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dark_mode: newVal }),
      });
    } catch {
      if (newVal) document.documentElement.classList.remove('dark');
      else document.documentElement.classList.add('dark');
      setIsDark(!newVal);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isDark ? <Moon className="h-5 w-5 text-pw-purple" strokeWidth={1.5} /> : <Sun className="h-5 w-5 text-amber-500" strokeWidth={1.5} />}
          <div>
            <p className="text-[14px] font-semibold text-pw-text">Donkere modus</p>
            <p className="text-[11px] text-pw-muted">{isDark ? 'Donker thema actief' : 'Licht thema actief'}</p>
          </div>
        </div>
        <button onClick={handleToggle} disabled={saving} className={`relative h-7 w-12 rounded-full transition-colors ${isDark ? 'bg-pw-purple' : 'bg-pw-border'}`}>
          {saving ? (
            <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" strokeWidth={2} />
          ) : (
            <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-5' : 'translate-x-0.5'}`} />
          )}
        </button>
      </div>
    </div>
  );
}
