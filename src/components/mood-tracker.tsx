'use client';

import { useState, useEffect } from 'react';

const MOODS = [
  { key: 'angstig', emoji: '😰', label: 'Angstig' },
  { key: 'gestrest', emoji: '😓', label: 'Gestrest' },
  { key: 'neutraal', emoji: '😐', label: 'Neutraal' },
  { key: 'opgelucht', emoji: '😌', label: 'Opgelucht' },
  { key: 'blij', emoji: '😊', label: 'Blij' },
];

export default function MoodTracker() {
  const [mood, setMood] = useState<string | null>(null);
  const [loggedToday, setLoggedToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    async function fetchMood() {
      try {
        const res = await fetch('/api/mood');
        if (res.ok) {
          const data = await res.json();
          if (data.logged_today) {
            setMood(data.mood);
            setLoggedToday(true);
          }
        }
      } catch {
        // Silent fail
      }
    }
    fetchMood();
  }, []);

  async function handleMoodSelect(selectedMood: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: selectedMood }),
      });
      if (res.ok) {
        setMood(selectedMood);
        setLoggedToday(true);
        setJustSaved(true);
        // Hide after 2 seconds
        setTimeout(() => setJustSaved(false), 2000);
      }
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  }

  // Already logged today — don't show the picker
  if (loggedToday && !justSaved) return null;

  // Just saved — show confirmation briefly
  if (justSaved && mood) {
    const selected = MOODS.find((m) => m.key === mood);
    return (
      <div className="rounded-card border border-pw-green/30 bg-green-50/50 p-4 text-center">
        <span className="text-[24px]">{selected?.emoji}</span>
        <p className="mt-1 text-[13px] font-semibold text-pw-green">Bedankt! Tot morgen.</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <p className="mb-3 text-center text-[13px] font-semibold text-pw-navy">
        Hoe voel je je vandaag?
      </p>
      <div className="flex justify-center gap-3">
        {MOODS.map((m) => (
          <button
            key={m.key}
            onClick={() => handleMoodSelect(m.key)}
            disabled={saving}
            className="btn-press flex flex-col items-center gap-1 rounded-card px-2 py-2 transition-colors hover:bg-pw-bg disabled:opacity-50"
          >
            <span className="text-[28px]">{m.emoji}</span>
            <span className="text-[10px] text-pw-muted">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
