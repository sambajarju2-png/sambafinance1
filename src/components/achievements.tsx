'use client';

import { useState, useEffect } from 'react';
import { Trophy, X, ChevronRight } from 'lucide-react';

interface Achievement {
  key: string;
  name: string;
  description: string;
  howTo: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  betalingen: 'Betalingen',
  streak: 'Streak',
  gezondheid: 'Financiële gezondheid',
  gebruik: 'App gebruik',
};

export default function AchievementsDisplay() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Achievement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/achievements');
        if (res.ok) {
          const data = await res.json();
          setAchievements(data.achievements || []);
        }
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const categories = ['betalingen', 'streak', 'gezondheid', 'gebruik'];

  if (loading) {
    return <div className="skeleton h-[200px] rounded-card" />;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
              <p className="text-[16px] font-bold text-pw-navy">Prestaties</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1">
              <span className="text-[13px] font-bold text-amber-600">{unlockedCount}</span>
              <span className="text-[11px] text-amber-500">/ {achievements.length}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-pw-border/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
              style={{ width: `${(unlockedCount / achievements.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Achievement grid by category */}
        {categories.map((cat) => {
          const catAchievements = achievements.filter((a) => a.category === cat);
          if (catAchievements.length === 0) return null;

          return (
            <div key={cat} className="rounded-card border border-pw-border bg-pw-surface p-4">
              <p className="mb-3 text-[12px] font-semibold text-pw-muted">{CATEGORY_LABELS[cat]}</p>
              <div className="grid grid-cols-4 gap-2">
                {catAchievements.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setSelected(a)}
                    className={`btn-press flex flex-col items-center gap-1 rounded-card p-2 text-center transition-all ${
                      a.unlocked
                        ? 'bg-amber-50/50 hover:bg-amber-50'
                        : 'opacity-30 grayscale hover:opacity-50'
                    }`}
                  >
                    <span className="text-[26px]">{a.icon}</span>
                    <span className="text-[9px] font-semibold leading-tight text-pw-text">{a.name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* How to earn section */}
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <p className="mb-3 text-[14px] font-bold text-pw-navy">Hoe verdien je prestaties?</p>
          <div className="space-y-2">
            {achievements.filter((a) => !a.unlocked).slice(0, 5).map((a) => (
              <button
                key={a.key}
                onClick={() => setSelected(a)}
                className="flex w-full items-center gap-3 rounded-input px-2 py-2 text-left transition-colors hover:bg-pw-bg"
              >
                <span className="text-[20px] grayscale opacity-40">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-pw-text">{a.name}</p>
                  <p className="text-[10px] text-pw-muted truncate">{a.howTo}</p>
                </div>
                <ChevronRight className="h-3 w-3 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
              </button>
            ))}
          </div>
          {achievements.filter((a) => !a.unlocked).length > 5 && (
            <p className="mt-2 text-center text-[10px] text-pw-muted">
              + {achievements.filter((a) => !a.unlocked).length - 5} meer te ontgrendelen
            </p>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelected(null)} />
          <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-card-lg bg-pw-surface p-6 shadow-lg">
            <button onClick={() => setSelected(null)} className="absolute right-3 top-3 p-1">
              <X className="h-5 w-5 text-pw-muted" strokeWidth={1.5} />
            </button>

            <div className="flex flex-col items-center text-center">
              <span className={`text-[48px] ${selected.unlocked ? '' : 'grayscale opacity-40'}`}>
                {selected.icon}
              </span>
              <h3 className="mt-2 text-[18px] font-bold text-pw-navy">{selected.name}</h3>
              <p className="mt-1 text-[13px] text-pw-muted">{selected.description}</p>

              <div className="mt-4 w-full rounded-card bg-pw-bg p-3">
                <p className="text-[11px] font-semibold text-pw-muted">Hoe ontgrendel je dit?</p>
                <p className="mt-1 text-[13px] text-pw-text">{selected.howTo}</p>
              </div>

              {selected.unlocked && selected.unlocked_at && (
                <p className="mt-3 text-[11px] text-pw-green font-semibold">
                  Ontgrendeld op {new Date(selected.unlocked_at).toLocaleDateString('nl-NL', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </p>
              )}

              {!selected.unlocked && (
                <div className="mt-3 flex items-center gap-1.5 rounded-full bg-pw-border/50 px-3 py-1">
                  <span className="text-[11px] font-semibold text-pw-muted">Nog niet ontgrendeld</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
