'use client';

import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';

interface Achievement {
  key: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export default function AchievementsDisplay() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="skeleton h-[120px] rounded-card" />;
  }

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
          <p className="text-[14px] font-semibold text-pw-navy">Prestaties</p>
        </div>
        <span className="text-[12px] font-semibold text-pw-muted">
          {unlockedCount}/{achievements.length}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {achievements.map((a) => (
          <div
            key={a.key}
            className={`flex flex-col items-center gap-1 rounded-card p-2 text-center transition-opacity ${
              a.unlocked ? 'opacity-100' : 'opacity-30 grayscale'
            }`}
            title={a.unlocked ? `${a.name}: ${a.description}` : `${a.name} (vergrendeld)`}
          >
            <span className="text-[24px]">{a.icon}</span>
            <span className="text-[9px] font-semibold leading-tight text-pw-text">{a.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
