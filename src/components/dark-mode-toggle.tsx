'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function DarkModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5" />
            <div>
              <p className="text-[14px] font-semibold text-pw-text">Thema</p>
              <p className="text-[11px] text-pw-muted">Laden...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isDark ? (
            <Moon className="h-5 w-5 text-pw-purple" strokeWidth={1.5} />
          ) : (
            <Sun className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
          )}
          <div>
            <p className="text-[14px] font-semibold text-pw-text">Thema</p>
            <p className="text-[11px] text-pw-muted">
              {isDark ? 'Donker thema actief' : 'Licht thema actief'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className={`relative h-7 w-12 rounded-full transition-colors ${
            isDark ? 'bg-pw-purple' : 'bg-pw-border'
          }`}
        >
          <div
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              isDark ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
