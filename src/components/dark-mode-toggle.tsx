'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { IOSSwitch } from '@/components/ui/ios-switch';

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
        <IOSSwitch
          checked={isDark}
          onChange={(v) => setTheme(v ? 'dark' : 'light')}
        />
      </div>
    </div>
  );
}
