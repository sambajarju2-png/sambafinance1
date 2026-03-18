'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Trophy, X, ChevronRight } from 'lucide-react';

interface Achievement {
  key: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export default function AchievementsDisplay() {
  const t = useTranslations('achievements');
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
      } catch { /* silent */ } finally { setLoading(false); }
    }
    load();
  }, []);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const categories = ['betalingen', 'streak', 'gezondheid', 'gebruik'];

  // Helper to get translated name/desc/howTo from translation file
  const getName = (key: string) => { try { return t(`items.${key}.name`); } catch { return key; } };
  const getDesc = (key: string) => { try { return t(`items.${key}.desc`); } catch { return ''; } };
  const getHowTo = (key: string) => { try { return t(`items.${key}.howTo`); } catch { return ''; } };
  const getCatLabel = (cat: string) => { try { return t(`categories.${cat}`); } catch { return cat; } };

  if (loading) return <div className="skeleton h-[200px] rounded-card" />;

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
              <p className="text-[16px] font-bold text-pw-navy">{t('title')}</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1">
              <span className="text-[13px] font-bold text-amber-600">{unlockedCount}</span>
              <span className="text-[11px] text-amber-500">/ {achievements.length}</span>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-pw-border/50">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
              style={{ width: `${(unlockedCount / Math.max(achievements.length, 1)) * 100}%` }} />
          </div>
        </div>

        {/* Grid by category */}
        {categories.map((cat) => {
          const catAchievements = achievements.filter((a) => a.category === cat);
          if (catAchievements.length === 0) return null;
          return (
            <div key={cat} className="rounded-card border border-pw-border bg-pw-surface p-4">
              <p className="mb-3 text-[12px] font-semibold text-pw-muted">{getCatLabel(cat)}</p>
              <div className="grid grid-cols-4 gap-2">
                {catAchievements.map((a) => (
                  <button key={a.key} onClick={() => setSelected(a)}
                    className={`btn-press flex flex-col items-center gap-1 rounded-card p-2 text-center transition-all ${
                      a.unlocked ? 'bg-amber-50/50 hover:bg-amber-50' : 'opacity-30 grayscale hover:opacity-50'}`}>
                    <span className="text-[26px]">{a.icon}</span>
                    <span className="text-[9px] font-semibold leading-tight text-pw-text">{getName(a.key)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* How to earn */}
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <p className="mb-3 text-[14px] font-bold text-pw-navy">{t('howToTitle')}</p>
          <div className="space-y-2">
            {achievements.filter((a) => !a.unlocked).slice(0, 5).map((a) => (
              <button key={a.key} onClick={() => setSelected(a)}
                className="flex w-full items-center gap-3 rounded-input px-2 py-2 text-left transition-colors hover:bg-pw-bg">
                <span className="text-[20px] grayscale opacity-40">{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-pw-text">{getName(a.key)}</p>
                  <p className="truncate text-[10px] text-pw-muted">{getHowTo(a.key)}</p>
                </div>
                <ChevronRight className="h-3 w-3 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
              </button>
            ))}
          </div>
          {achievements.filter((a) => !a.unlocked).length > 5 && (
            <p className="mt-2 text-center text-[10px] text-pw-muted">
              + {achievements.filter((a) => !a.unlocked).length - 5} {t('moreToUnlock')}
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
              <span className={`text-[48px] ${selected.unlocked ? '' : 'grayscale opacity-40'}`}>{selected.icon}</span>
              <h3 className="mt-2 text-[18px] font-bold text-pw-navy">{getName(selected.key)}</h3>
              <p className="mt-1 text-[13px] text-pw-muted">{getDesc(selected.key)}</p>
              <div className="mt-4 w-full rounded-card bg-pw-bg p-3">
                <p className="text-[11px] font-semibold text-pw-muted">{t('howToUnlock')}</p>
                <p className="mt-1 text-[13px] text-pw-text">{getHowTo(selected.key)}</p>
              </div>
              {selected.unlocked && selected.unlocked_at && (
                <p className="mt-3 text-[11px] font-semibold text-pw-green">
                  {t('unlockedOn')} {new Date(selected.unlocked_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {!selected.unlocked && (
                <div className="mt-3 rounded-full bg-pw-border/50 px-3 py-1">
                  <span className="text-[11px] font-semibold text-pw-muted">{t('locked')}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
