'use client';

import { useState, useEffect } from 'react';
import { MapPin, Check, Loader2 } from 'lucide-react';

export default function GemeenteSelector() {
  const [gemeentes, setGemeentes] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Fetch available gemeentes
        const listRes = await fetch('/api/gemeente/list');
        if (listRes.ok) {
          const data = await listRes.json();
          setGemeentes(data.gemeentes || []);
        }
        // Fetch current user gemeente
        const currentRes = await fetch('/api/gemeente');
        if (currentRes.ok) {
          const data = await currentRes.json();
          setSelected(data.gemeente || '');
        }
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(gemeente: string) {
    setSelected(gemeente);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/gemeente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gemeente: gemeente || null }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Silent
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <div className="skeleton h-[60px] rounded-input" />
      </div>
    );
  }

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-pw-purple" strokeWidth={1.5} />
        <p className="text-[14px] font-semibold text-pw-navy">Gemeente</p>
      </div>
      <p className="mb-3 text-[12px] text-pw-muted">
        Kies je gemeente voor lokale hulporganisaties bij schulden.
      </p>
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => handleSave(e.target.value)}
          className="flex-1 rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
        >
          <option value="">Selecteer je gemeente...</option>
          {gemeentes.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-pw-muted" strokeWidth={1.5} />}
        {saved && <Check className="h-4 w-4 text-pw-green" strokeWidth={2} />}
      </div>
    </div>
  );
}
