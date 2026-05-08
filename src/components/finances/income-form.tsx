'use client';

import { useState, useEffect } from 'react';
import {
  Wallet, Users, GraduationCap, HandCoins, Gift, CalendarDays,
  Baby, Home, Briefcase, Loader2, Check, Plus, Minus, Heart, ChevronDown
} from 'lucide-react';
import { formatCents } from '@/lib/bills';
import { useTranslations } from 'next-intl';

interface FinancesData {
  netto_inkomen: number;
  partner_inkomen: number;
  duo_inkomen: number;
  uitkering_inkomen: number;
  toeslagen_inkomen: number;
  overig_inkomen: number;
  salary_day_from: number | null;
  salary_day_to: number | null;
  has_partner: boolean;
  num_children: number;
  children_ages: number[];
  monthly_rent: number;
  has_kinderopvang: boolean;
  vermogen: number;
}

const INITIAL: FinancesData = {
  netto_inkomen: 0,
  partner_inkomen: 0,
  duo_inkomen: 0,
  uitkering_inkomen: 0,
  toeslagen_inkomen: 0,
  overig_inkomen: 0,
  salary_day_from: null,
  salary_day_to: null,
  has_partner: false,
  num_children: 0,
  children_ages: [],
  monthly_rent: 0,
  has_kinderopvang: false,
  vermogen: 0,
};

function CentsInput({
  value, onChange, placeholder = '0', icon, label,
}: {
  value: number; onChange: (cents: number) => void; placeholder?: string;
  icon: React.ReactNode; label: string;
}) {
  const [display, setDisplay] = useState(value > 0 ? (value / 100).toString() : '');
  useEffect(() => { setDisplay(value > 0 ? (value / 100).toString() : ''); }, [value]);

  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-pw-muted">{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pw-muted">{icon}</div>
        <input
          type="number" inputMode="decimal" placeholder={placeholder}
          className="w-full rounded-xl border border-pw-border bg-pw-surface py-2.5 pl-10 pr-10 text-[15px] font-medium text-pw-text outline-none transition-colors focus:border-pw-blue focus:ring-1 focus:ring-pw-blue/20"
          value={display}
          onChange={(e) => {
            setDisplay(e.target.value);
            const euros = parseFloat(e.target.value);
            onChange(isNaN(euros) ? 0 : Math.round(euros * 100));
          }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-pw-muted">€/mnd</span>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, children, defaultOpen = true }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-pw-border/60 bg-pw-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pw-blue/[0.07]">
            {icon}
          </div>
          <span className="text-[14px] font-semibold text-pw-text">{title}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-pw-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-pw-border/40 px-4 py-4 space-y-3">{children}</div>}
    </div>
  );
}

export default function IncomeForm({ onSaved }: { onSaved?: () => void }) {
  const t = useTranslations('incomeForm');
  const [data, setData] = useState<FinancesData>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/finances')
      .then(r => r.json())
      .then(d => { if (d && d.netto_inkomen !== undefined) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onSaved?.();
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  function updateField<K extends keyof FinancesData>(key: K, val: FinancesData[K]) {
    setData(prev => ({ ...prev, [key]: val }));
  }

  function addChild() {
    updateField('num_children', data.num_children + 1);
    updateField('children_ages', [...data.children_ages, 0]);
  }

  function removeChild(idx: number) {
    const ages = [...data.children_ages];
    ages.splice(idx, 1);
    updateField('children_ages', ages);
    updateField('num_children', Math.max(0, data.num_children - 1));
  }

  function setChildAge(idx: number, age: number) {
    const ages = [...data.children_ages];
    ages[idx] = age;
    updateField('children_ages', ages);
  }

  const totalIncome = data.netto_inkomen + data.partner_inkomen + data.duo_inkomen +
    data.uitkering_inkomen + data.toeslagen_inkomen + data.overig_inkomen;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-pw-border/30 bg-pw-surface p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-pw-border/40" />
              <div className="h-3.5 w-20 rounded bg-pw-border/50" />
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="h-2.5 w-32 rounded bg-pw-border/30" />
                <div className="h-10 w-full rounded-lg bg-pw-border/20" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2.5 w-24 rounded bg-pw-border/30" />
                <div className="h-10 w-full rounded-lg bg-pw-border/20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section 1: Inkomen */}
      <SectionCard
        icon={<Wallet className="h-4 w-4 text-pw-blue" />}
        title={t("income")}
        defaultOpen={true}
      >
        <CentsInput
          icon={<Wallet className="h-4 w-4" />}
          label={t("netIncomePerMonth")}
          value={data.netto_inkomen}
          onChange={v => updateField('netto_inkomen', v)}
          placeholder="bijv. 2200"
        />
        <CentsInput
          icon={<GraduationCap className="h-4 w-4" />}
          label={t("duoStudyFinance")}
          value={data.duo_inkomen}
          onChange={v => updateField('duo_inkomen', v)}
        />
        <CentsInput
          icon={<HandCoins className="h-4 w-4" />}
          label={t("benefitIncome")}
          value={data.uitkering_inkomen}
          onChange={v => updateField('uitkering_inkomen', v)}
        />
        <CentsInput
          icon={<Gift className="h-4 w-4" />}
          label={t("otherIncome")}
          value={data.overig_inkomen}
          onChange={v => updateField('overig_inkomen', v)}
        />
      </SectionCard>

      {/* Section 2: Salarisbetaling */}
      <SectionCard
        icon={<CalendarDays className="h-4 w-4 text-pw-blue" />}
        title={t("salaryPayment")}
        defaultOpen={data.salary_day_from !== null}
      >
        <p className="text-[12px] text-pw-muted">Tussen welke dagen van de maand krijg je betaald?</p>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] text-pw-muted">Van dag</label>
            <input
              type="number" inputMode="numeric" min={1} max={31}
              className="w-full rounded-xl border border-pw-border bg-pw-surface px-3 py-2.5 text-center text-[15px] font-medium outline-none focus:border-pw-blue"
              value={data.salary_day_from || ''}
              onChange={e => updateField('salary_day_from', parseInt(e.target.value) || null)}
              placeholder="22"
            />
          </div>
          <span className="mt-5 text-pw-muted">tot</span>
          <div className="flex-1">
            <label className="mb-1 block text-[11px] text-pw-muted">Tot dag</label>
            <input
              type="number" inputMode="numeric" min={1} max={31}
              className="w-full rounded-xl border border-pw-border bg-pw-surface px-3 py-2.5 text-center text-[15px] font-medium outline-none focus:border-pw-blue"
              value={data.salary_day_to || ''}
              onChange={e => updateField('salary_day_to', parseInt(e.target.value) || null)}
              placeholder="25"
            />
          </div>
        </div>
      </SectionCard>

      {/* Section 3: Huishouden */}
      <SectionCard
        icon={<Users className="h-4 w-4 text-pw-blue" />}
        title={t("household")}
        defaultOpen={data.has_partner || data.num_children > 0}
      >
        {/* Partner */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-pw-muted" />
            <span className="text-[13px] font-medium">Heb je een partner?</span>
          </div>
          <button
            onClick={() => {
              updateField('has_partner', !data.has_partner);
              if (data.has_partner) updateField('partner_inkomen', 0);
            }}
            className={`relative h-6 w-11 rounded-full transition-colors ${data.has_partner ? 'bg-pw-blue' : 'bg-pw-border'}`}
          >
            <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${data.has_partner ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {data.has_partner && (
          <CentsInput
            icon={<Briefcase className="h-4 w-4" />}
            label={t("netIncomePartner")}
            value={data.partner_inkomen}
            onChange={v => updateField('partner_inkomen', v)}
          />
        )}

        {/* Children */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Baby className="h-4 w-4 text-pw-muted" />
              <span className="text-[13px] font-medium">Kinderen onder 18</span>
            </div>
            <button
              onClick={addChild}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-pw-blue/10 text-pw-blue"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {data.children_ages.map((age, idx) => (
            <div key={idx} className="mb-2 flex items-center gap-2">
              <span className="w-16 text-[12px] text-pw-muted">Kind {idx + 1}</span>
              <input
                type="number" inputMode="numeric" min={0} max={17}
                className="flex-1 rounded-lg border border-pw-border bg-pw-surface px-3 py-1.5 text-[14px] outline-none focus:border-pw-blue"
                value={age}
                onChange={e => setChildAge(idx, parseInt(e.target.value) || 0)}
                placeholder={t("age")}
              />
              <span className="text-[11px] text-pw-muted">jaar</span>
              <button
                onClick={() => removeChild(idx)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-pw-red hover:bg-pw-red/10"
              >
                <Minus className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Section 4: Toeslagen check */}
      <SectionCard
        icon={<Heart className="h-4 w-4 text-pw-blue" />}
        title={t("benefitsCheck")}
        defaultOpen={data.monthly_rent > 0 || data.vermogen > 0}
      >
        <p className="text-[12px] text-pw-muted mb-2">
          Vul dit in om te zien of je recht hebt op toeslagen. Je huur wordt automatisch
          overgenomen als je die bij vaste lasten hebt toegevoegd.
        </p>
        <CentsInput
          icon={<Home className="h-4 w-4" />}
          label={t("bareRent")}
          value={data.monthly_rent}
          onChange={v => updateField('monthly_rent', v)}
        />

        {data.num_children > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">Kinderopvang?</span>
            <button
              onClick={() => updateField('has_kinderopvang', !data.has_kinderopvang)}
              className={`relative h-6 w-11 rounded-full transition-colors ${data.has_kinderopvang ? 'bg-pw-blue' : 'bg-pw-border'}`}
            >
              <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${data.has_kinderopvang ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        <div>
          <label className="mb-1 block text-[12px] font-medium text-pw-muted">Spaargeld / vermogen</label>
          <div className="relative">
            <input
              type="number" inputMode="decimal"
              className="w-full rounded-xl border border-pw-border bg-pw-surface py-2.5 pl-4 pr-10 text-[15px] font-medium outline-none focus:border-pw-blue"
              value={data.vermogen > 0 ? data.vermogen / 100 : ''}
              onChange={e => {
                const val = parseFloat(e.target.value);
                updateField('vermogen', isNaN(val) ? 0 : Math.round(val * 100));
              }}
              placeholder="0"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-pw-muted">€</span>
          </div>
        </div>
      </SectionCard>

      {/* Total + save */}
      {totalIncome > 0 && (
        <div className="rounded-xl border border-pw-blue/20 bg-pw-blue/[0.04] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-pw-muted">Totaal maandinkomen</span>
            <span className="text-[18px] font-bold text-pw-blue">{formatCents(totalIncome)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-pw-blue py-3 text-[14px] font-semibold text-white transition-colors hover:bg-pw-blue/90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <><Check className="h-4 w-4" /> Opgeslagen</>
        ) : (
          t('save')
        )}
      </button>
    </div>
  );
}
