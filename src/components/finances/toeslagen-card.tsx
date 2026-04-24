'use client';

import { useState, useEffect } from 'react';
import { Heart, Home, Baby, Sun, ExternalLink, X, Gift, AlertTriangle, ChevronDown, ChevronUp, Loader2, Check } from 'lucide-react';
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

interface ToeslagenActueel {
  zorgtoeslag: number;
  huurtoeslag: number;
  kindgebonden_budget: number;
  kinderopvangtoeslag: number;
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

const TOESLAG_LABELS: Record<string, string> = {
  zorgtoeslag: 'Zorgtoeslag',
  huurtoeslag: 'Huurtoeslag',
  kindgebonden_budget: 'Kindgebonden budget',
  kinderopvangtoeslag: 'Kinderopvangtoeslag',
};

const DEFAULT_ACTUEEL: ToeslagenActueel = {
  zorgtoeslag: 0,
  huurtoeslag: 0,
  kindgebonden_budget: 0,
  kinderopvangtoeslag: 0,
};

export default function ToeslagenCard() {
  const [data, setData] = useState<ToeslagenData | null>(null);
  const [actueel, setActueel] = useState<ToeslagenActueel>(DEFAULT_ACTUEEL);
  const [loading, setLoading] = useState(true);
  const [showControl, setShowControl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable amounts (display as euros, store as cents)
  const [editValues, setEditValues] = useState<Record<string, string>>({
    zorgtoeslag: '',
    huurtoeslag: '',
    kindgebonden_budget: '',
    kinderopvangtoeslag: '',
  });

  useEffect(() => {
    fetch('/api/finances')
      .then(r => r.json())
      .then(d => {
        if (d?.toeslagen_eligible?.zorgtoeslag) {
          setData(d.toeslagen_eligible);
        }
        if (d?.toeslagen_actueel) {
          const a = { ...DEFAULT_ACTUEEL, ...d.toeslagen_actueel };
          setActueel(a);
          setEditValues({
            zorgtoeslag: a.zorgtoeslag > 0 ? (a.zorgtoeslag / 100).toFixed(2).replace('.', ',') : '',
            huurtoeslag: a.huurtoeslag > 0 ? (a.huurtoeslag / 100).toFixed(2).replace('.', ',') : '',
            kindgebonden_budget: a.kindgebonden_budget > 0 ? (a.kindgebonden_budget / 100).toFixed(2).replace('.', ',') : '',
            kinderopvangtoeslag: a.kinderopvangtoeslag > 0 ? (a.kinderopvangtoeslag / 100).toFixed(2).replace('.', ',') : '',
          });
          // Auto-show control if any actual amounts entered
          if ((Object.values(a) as number[]).some(v => v > 0)) setShowControl(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveActueel() {
    setSaving(true);
    setSaved(false);

    const parseCents = (val: string) => {
      const cleaned = val.replace(/[^\d,.-]/g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : Math.round(num * 100);
    };

    const newActueel: ToeslagenActueel = {
      zorgtoeslag: parseCents(editValues.zorgtoeslag),
      huurtoeslag: parseCents(editValues.huurtoeslag),
      kindgebonden_budget: parseCents(editValues.kindgebonden_budget),
      kinderopvangtoeslag: parseCents(editValues.kinderopvangtoeslag),
    };

    try {
      // Load existing finances to include in POST
      const existingRes = await fetch('/api/finances');
      const existing = await existingRes.json();

      await fetch('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...existing,
          toeslagen_actueel: newActueel,
        }),
      });

      setActueel(newActueel);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  }

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

  // Check for overpayment
  const overpayments = eligible
    .filter(t => {
      const act = actueel[t.key as keyof ToeslagenActueel] || 0;
      return act > 0 && act > t.geschat_bedrag && t.geschat_bedrag > 0;
    })
    .map(t => ({
      ...t,
      actueel: actueel[t.key as keyof ToeslagenActueel],
      verschil: actueel[t.key as keyof ToeslagenActueel] - t.geschat_bedrag,
    }));

  const totaalActueel = Object.values(actueel).reduce((sum, v) => sum + v, 0);

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
              const act = actueel[toeslag.key as keyof ToeslagenActueel] || 0;
              const isOver = act > 0 && act > toeslag.geschat_bedrag && toeslag.geschat_bedrag > 0;

              return (
                <div key={toeslag.key} className={`flex items-start gap-3 rounded-lg p-3 ${isOver ? 'bg-amber-50/80 dark:bg-amber-500/[0.06]' : 'bg-white/60 dark:bg-pw-surface'}`}>
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
                    <Icon className={`h-4 w-4 ${textColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-pw-text">{toeslag.naam}</p>
                      <div className="text-right">
                        {toeslag.geschat_bedrag > 0 && (
                          <span className="text-[14px] font-bold text-pw-green">
                            +{formatCents(toeslag.geschat_bedrag)}/mnd
                          </span>
                        )}
                        {act > 0 && (
                          <p className={`text-[10px] ${isOver ? 'font-semibold text-amber-600' : 'text-pw-muted'}`}>
                            Ontvangt: {formatCents(act)}/mnd
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-pw-muted">{toeslag.reden}</p>
                    {isOver && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Mogelijk {formatCents(act - toeslag.geschat_bedrag)}/mnd te veel — check je beschikking
                      </p>
                    )}
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

      {/* Overpayment warning banner */}
      {overpayments.length > 0 && (
        <div className="rounded-xl border border-amber-300/40 bg-amber-50/60 dark:bg-amber-500/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Je ontvangt mogelijk te veel toeslagen
          </p>
          <p className="mt-1 text-[11px] text-amber-600/80">
            Te veel ontvangen toeslagen moet je terugbetalen aan de Belastingdienst. Controleer je beschikkingen of doe een proefberekening.
          </p>
        </div>
      )}

      {/* Current toeslagen control section */}
      <button
        onClick={() => setShowControl(!showControl)}
        className="flex w-full items-center justify-between rounded-xl border border-pw-border bg-pw-surface p-3 text-left"
      >
        <div>
          <p className="text-[13px] font-medium text-pw-navy">Mijn huidige toeslagen</p>
          <p className="text-[11px] text-pw-muted">
            {totaalActueel > 0
              ? `Je ontvangt ${formatCents(totaalActueel)}/mnd`
              : 'Vul in wat je nu ontvangt om te controleren'}
          </p>
        </div>
        {showControl ? (
          <ChevronUp className="h-4 w-4 text-pw-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-pw-muted" />
        )}
      </button>

      {showControl && (
        <div className="rounded-xl border border-pw-border bg-pw-surface p-4 space-y-3">
          <p className="text-[11px] text-pw-muted">
            Vul per toeslag in wat je maandelijks ontvangt. Dit staat op je beschikking van de Belastingdienst.
          </p>

          {(['zorgtoeslag', 'huurtoeslag', 'kindgebonden_budget', 'kinderopvangtoeslag'] as const).map(key => {
            const Icon = TOESLAG_ICONS[key] || Gift;
            const colorClass = TOESLAG_COLORS[key] || 'text-gray-500 bg-gray-50';
            const [textColor, bgColor] = colorClass.split(' ');

            return (
              <div key={key} className="flex items-center gap-3">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
                  <Icon className={`h-3.5 w-3.5 ${textColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-[12px] font-medium text-pw-text">{TOESLAG_LABELS[key]}</label>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[12px] text-pw-muted">€</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editValues[key]}
                    onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder="0,00"
                    className="w-[80px] rounded-input border border-pw-border bg-pw-bg px-2 py-1.5 text-right text-[13px] text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
                  />
                </div>
              </div>
            );
          })}

          <button
            onClick={handleSaveActueel}
            disabled={saving || saved}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
             saved ? <Check className="h-3.5 w-3.5" /> : null}
            {saved ? 'Opgeslagen' : 'Opslaan'}
          </button>
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
