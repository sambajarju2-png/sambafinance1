import { useTranslations } from 'next-intl';
import { LayoutDashboard, Camera, Mail } from 'lucide-react';

export default function OverzichtPage() {
  const t = useTranslations('dashboard');

  return (
    <div className="space-y-4">
      {/* Page heading */}
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>

      {/* Stat cards placeholder (2x2 grid) */}
      <div className="grid grid-cols-2 gap-2">
        <StatCardPlaceholder label={t('outstanding')} value="€0" color="blue" />
        <StatCardPlaceholder label={t('overdue')} value="0" color="red" />
        <StatCardPlaceholder label={t('upcoming')} value="0" color="amber" />
        <StatCardPlaceholder label={t('paid')} value="€0" color="green" />
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white">
          <Camera className="h-4 w-4" strokeWidth={1.5} />
          {t('scanBill')}
        </button>
        <button className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-text">
          <Mail className="h-4 w-4" strokeWidth={1.5} />
          {t('scanEmail')}
        </button>
      </div>

      {/* Empty state for bills list */}
      <div className="flex flex-col items-center py-12 text-center">
        <LayoutDashboard className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
        <h2 className="text-[16px] font-semibold text-pw-text">{t('noBillsTitle')}</h2>
        <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">
          {t('noBillsDescription')}
        </p>
      </div>
    </div>
  );
}

function StatCardPlaceholder({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'blue' | 'red' | 'amber' | 'green';
}) {
  const gradients = {
    blue: 'bg-gradient-to-br from-blue-50 to-white',
    red: 'bg-gradient-to-br from-red-50 to-white',
    amber: 'bg-gradient-to-br from-amber-50 to-white',
    green: 'bg-gradient-to-br from-green-50 to-white',
  };

  const accentColors = {
    blue: 'before:bg-pw-blue',
    red: 'before:bg-pw-red',
    amber: 'before:bg-pw-amber',
    green: 'before:bg-pw-green',
  };

  const valueColors = {
    blue: 'text-pw-blue',
    red: 'text-pw-red',
    amber: 'text-pw-amber',
    green: 'text-pw-green',
  };

  return (
    <div
      className={`stat-card ${accentColors[color]} ${gradients[color]} px-3.5 py-3`}
    >
      <p className="text-[11px] font-medium text-pw-muted">{label}</p>
      <p className={`mt-1 text-[24px] font-extrabold ${valueColors[color]}`}>{value}</p>
    </div>
  );
}
