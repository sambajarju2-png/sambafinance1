'use client';

import { useState, useEffect } from 'react';
import { Heart, Home, Baby, Sun, ExternalLink, Check, X, Loader2, Gift } from 'lucide-react';
import { formatCents } from '@/lib/bills';

interface ToeslagResult {
  naam: string;
  eligible: boolean;
  reden: string;
  geschat_bedrag: number;
  actie: string;
}

interface ToeslagenData {
  zorgtoeslag: ToeslagResult;
  huurtoeslag: ToeslagResult;
  kindgebonden_budget: ToeslagResult;
  kinderopvangtoeslag: ToeslagResult;
  totaal_geschat: number;
}

const TOESLAG_ICONS: Record<string, typeof Heart> = {
  zorgtoeslag: Heart,
  huurtoeslag: Home,
  kindgebonden_budget: Baby,
  kinderopvangtoeslag: Sun,
};

const TOESLAG_COLORS: Record<string, string> = {
  zorgtoeslag: 'text-red-500 bg-red-50 dark:bg-red-500/10',
  huurtoeslag: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10',
  kindgebonden_budget: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
  kinderopvangtoeslag: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
};

export default function ToeslagenCard() {
  const [data, setData] = useState<ToeslagenData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/finances')
      .then(r => r.json())
      .then(d => {
        if (d?.toeslagen_eligible?.zorgtoeslag) {
          setData(d.toeslagen_eligible);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-pw-border/50" />
        <div className="h-3 w-28 rounded bg-pw-border/50" />
      </div>
      <div className="rounded-xl border border-pw-border/30 p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-start gap-3 rounded-lg bg-pw-bg p-3">
            <div className="h-8 w-8 rounded-lg bg-pw-border/40 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-pw-border/40" />
              <div className="h-2 w-36 rounded bg-pw-border/30" />
            </div>
            <div className="h-4 w-16 rounded bg-pw-border/40" />
          </div>
        ))}
      </div>
    </div>
  );
  if (!data) return null;

  const eligible = Object.entries(data)
    .filter(([key, val]) => key !== 'totaal_geschat' && typeof val === 'object' && val.eligible)
    .map(([key, val]) => ({ key, ...(val as ToeslagResult) }));

  const notEligible = Object.entries(data)
    .filter(([key, val]) => key !== 'totaal_geschat' && typeof val === 'object' && !val.eligible)
    .map(([key, val]) => ({ key, ...(val as ToeslagResult) }));

  if (eligible.length === 0 && notEligible.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-pw-blue" />
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-pw-muted">Toeslagen check</h3>
      </div>

      {eligible.length > 0 && (
        <div className="rounded-xl border border-pw-green/20 bg-pw-green/[0.04] p-4">
          <p className="mb-3 text-[13px] font-medium text-pw-green">
            Je komt mogelijk in aanmerking voor {eligible.length} toeslag{eligible.length > 1 ? 'en' : ''}
          </p>
          <div className="space-y-2.5">
            {eligible.map(toeslag => {
              const Icon = TOESLAG_ICONS[toeslag.key] || Gift;
              const colorClass = TOESLAG_COLORS[toeslag.key] || 'text-gray-500 bg-gray-50';
              const [textColor, bgColor] = colorClass.split(' ');

              return (
                <div key={toeslag.key} className="flex items-start gap-3 rounded-lg bg-white/60 dark:bg-pw-surface p-3">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
                    <Icon className={`h-4 w-4 ${textColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-pw-text">{toeslag.naam}</p>
                      {toeslag.geschat_bedrag > 0 && (
                        <span className="text-[14px] font-bold text-pw-green">
                          +{formatCents(toeslag.geschat_bedrag)}/mnd
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-pw-muted">{toeslag.reden}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {data.totaal_geschat > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-pw-green/10 pt-3">
              <span className="text-[12px] text-pw-muted">Geschat totaal per maand</span>
              <span className="text-[16px] font-bold text-pw-green">+{formatCents(data.totaal_geschat)}</span>
            </div>
          )}
          <a
            href="https://www.toeslagen.nl/proefberekening"
            target="_blank"
            rel="noopener"
            className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-pw-blue"
          >
            Doe een exacte proefberekening op toeslagen.nl
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {notEligible.length > 0 && (
        <div className="rounded-xl border border-pw-border/60 bg-pw-bg p-3">
          <p className="mb-2 text-[11px] text-pw-muted">Niet in aanmerking:</p>
          {notEligible.map(toeslag => (
            <div key={toeslag.key} className="flex items-center gap-2 py-1">
              <X className="h-3 w-3 text-pw-muted" />
              <span className="text-[12px] text-pw-muted">{toeslag.naam}: {toeslag.reden}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
