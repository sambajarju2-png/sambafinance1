'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  ArrowDownUp,
  Loader2,
  Check,
} from 'lucide-react';
import { type DashboardModules, DEFAULT_MODULES } from '@/lib/dashboard-modules';

interface ModuleOption {
  key: keyof DashboardModules;
  label: string;
  description: string;
}

const HOME_MODULES: ModuleOption[] = [
  {
    key: 'home_vrij_besteedbaar',
    label: 'Vrij besteedbaar',
    description: 'Hoeveel je deze maand vrij te besteden hebt',
  },
  {
    key: 'home_schuldvrij_countdown',
    label: 'Schuldvrij countdown',
    description: 'Aftelling naar je schuldvrije datum',
  },
  {
    key: 'home_rewards',
    label: 'Prestaties',
    description: 'Badges en beloningen op je dashboard',
  },
];

const STATS_MODULES: ModuleOption[] = [
  {
    key: 'stats_category',
    label: 'Categorie overzicht',
    description: 'Verdeling per categorie op de prestatie tab',
  },
];

const CASHFLOW_MODULES: ModuleOption[] = [
  {
    key: 'cashflow_monthly_overview',
    label: 'Maandelijks overzicht',
    description: 'Geschiedenis van je maandelijkse uitgaven',
  },
  {
    key: 'cashflow_expected_expenses',
    label: 'Verwachte uitgaven',
    description: 'Vooruitblik op komende rekeningen',
  },
];

export default function DashboardModulesSettings() {
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
            {saving ? 'Opslaan...' : 'Opgeslagen'}
          </span>
        </div>
      )}

      {/* Home page modules */}
      <ModuleSection
        icon={<LayoutDashboard className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />}
        title="Dashboard"
        description="Onderdelen op je startpagina"
        options={HOME_MODULES}
        modules={modules}
        onToggle={handleToggle}
      />

      {/* Stats page modules */}
      <ModuleSection
        icon={<TrendingUp className="h-4 w-4 text-pw-green" strokeWidth={1.5} />}
        title="Statistieken"
        description="Onderdelen op de prestatie tab"
        options={STATS_MODULES}
        modules={modules}
        onToggle={handleToggle}
      />

      {/* Cashflow page modules */}
      <ModuleSection
        icon={<ArrowDownUp className="h-4 w-4 text-pw-amber" strokeWidth={1.5} />}
        title="Cashflow"
        description="Onderdelen op de cashflow tab"
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
  description: string;
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
              <p className="text-[13px] font-medium text-pw-text">{opt.label}</p>
              <p className="mt-0.5 text-[11px] text-pw-muted">{opt.description}</p>
            </div>
            <button
              onClick={() => onToggle(opt.key)}
              className={`relative inline-flex h-[28px] w-[50px] flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                modules[opt.key] ? 'bg-pw-blue' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={modules[opt.key]}
            >
              <span
                className={`inline-block h-[24px] w-[24px] rounded-full bg-white shadow-md transition-transform duration-200 ${
                  modules[opt.key] ? 'translate-x-[24px]' : 'translate-x-[2px]'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
