'use client';

import { useState, useEffect, useCallback } from 'react';

export interface DashboardModules {
  home_vrij_besteedbaar: boolean;
  home_schuldvrij_countdown: boolean;
  home_rewards: boolean;
  stats_category: boolean;
  cashflow_monthly_overview: boolean;
  cashflow_expected_expenses: boolean;
}

export const DEFAULT_MODULES: DashboardModules = {
  home_vrij_besteedbaar: true,
  home_schuldvrij_countdown: true,
  home_rewards: true,
  stats_category: true,
  cashflow_monthly_overview: true,
  cashflow_expected_expenses: true,
};

export function useDashboardModules() {
  const [modules, setModules] = useState<DashboardModules>(DEFAULT_MODULES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) {
          const data = await res.json();
          const saved = data.profile?.dashboard_modules;
          if (saved && typeof saved === 'object') {
            setModules({ ...DEFAULT_MODULES, ...saved });
          }
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const updateModule = useCallback(async (key: keyof DashboardModules, value: boolean) => {
    const updated = { ...modules, [key]: value };
    setModules(updated);

    try {
      await fetch('/api/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_modules: updated }),
      });
    } catch {
      // Revert on failure
      setModules(modules);
    }
  }, [modules]);

  return { modules, loading, updateModule };
}
