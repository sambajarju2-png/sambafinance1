'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect } from 'react';
import { IOSSwitch } from '@/components/ui/ios-switch';
import {
  LayoutDashboard,
  TrendingUp,
  ArrowDownUp,
  Loader2,
  Check,
} from 'lucide-react';
import { type DashboardModules, DEFAULT_MODULES } from '@/lib/dashboard-modules';
import { hapticFeedback } from '@/lib/capacitor';

interface ModuleOption {
  key: keyof DashboardModules;
  labelKey: string;
  descKey: string;
}

const HOME_MODULES: ModuleOption[] = [
  {
    key: 'home_vrij_besteedbaar',
    labelKey: 'disposable',
    descKey: 'disposableDesc',
  },
  {
    key: 'home_schuldvrij_countdown',
    labelKey: 'debtFreeCountdown',
    descKey: 'debtFreeCountdownDesc',
  },
  {
    key: 'home_rewards',
    labelKey: 'achievements',
    descKey: 'achievementsDesc',
  },
];

const STATS_MODULES: ModuleOption[] = [
  {
    key: 'stats_category',
    labelKey: 'categoryOverview',
    descKey: 'categoryOverviewDesc',
  },
];

const CASHFLOW_MODULES: ModuleOption[] = [
  {
    key: 'cashflow_monthly_overview',
    labelKey: 'monthlyOverview',
    descKey: 'monthlyOverviewDesc',
  },
  {
    key: 'cashflow_expected_expenses',
    labelKey: 'expectedExpenses',
    descKey: 'expectedExpensesDesc',
  },
];

export default function DashboardModulesSettings() {
  const t = useTranslations('modules');
  const [modules, setModules] = useState<DashboardModules>(DEFAULT_MODULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function handleToggle(key: keyof DashboardModules) {
    hapticFeedback('light');
    const updated = { ...modules, [key]: !modules[key] };
    setModules(updated);
    setSaving(true);
    setSaved(false);

    try {
      await fetch('/api/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_modules: updated }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // Revert
      setModules(modules);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[72px] rounded-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Save indicator */}
      {(saving || saved) && (
        <div className="flex items-center justify-center gap-2 rounded-input bg-pw-blue/5 py-2">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-pw-blue" strokeWidth={2} />
          ) : (
            <Check className="h-3.5 w-3.5 text-pw-green" strokeWidth={2} />
          )}
          <span className="text-[12px] font-medium text-pw-muted">
            {saving ? t('saving') : t('saved')}
          </span>
        </div>
      )}

      {/* Home page modules */}
      <ModuleSection
        icon={<LayoutDashboard className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />}
        title={t("dashboardTitle")}
        description={t("dashboardDesc")}
        options={HOME_MODULES}
        modules={modules}
        onToggle={handleToggle}
      />

      {/* Stats page modules */}
      <ModuleSection
        icon={<TrendingUp className="h-4 w-4 text-pw-green" strokeWidth={1.5} />}
        title="Statistieken"
        description={t("categoryOverviewDesc")}
        options={STATS_MODULES}
        modules={modules}
        onToggle={handleToggle}
      />

      {/* Cashflow page modules */}
      <ModuleSection
        icon={<ArrowDownUp className="h-4 w-4 text-pw-amber" strokeWidth={1.5} />}
        title="Cashflow"
        description={t("monthlyOverviewDesc")}
        options={CASHFLOW_MODULES}
        modules={modules}
        onToggle={handleToggle}
      />
    </div>
  );
}

function ModuleSection({
  icon,
  title,
  description,
  options,
  modules,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  descKey: string;
  options: ModuleOption[];
  modules: DashboardModules;
  onToggle: (key: keyof DashboardModules) => void;
}) {
  return (
    <div className="rounded-card border border-pw-border bg-pw-surface">
      {/* Section header */}
      <div className="flex items-center gap-3 border-b border-pw-border/50 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-input bg-pw-bg">
          {icon}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-pw-text">{title}</p>
          <p className="text-[11px] text-pw-muted">{description}</p>
        </div>
      </div>

      {/* Toggle rows */}
      <div className="divide-y divide-pw-border/30">
        {options.map((opt) => (
          <div
            key={opt.key}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex-1 pr-4">
              <p className="text-[13px] font-medium text-pw-text">{t(t(opt.labelKey)Key)}</p>
              <p className="mt-0.5 text-[11px] text-pw-muted">{t(opt.descKey)}</p>
            </div>
            <IOSSwitch
              checked={modules[opt.key]}
              onChange={() => onToggle(opt.key)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
