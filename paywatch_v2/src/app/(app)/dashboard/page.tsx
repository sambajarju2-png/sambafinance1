import { useTranslations } from 'next-intl';
import { Shield, Camera, Mail, CreditCard } from 'lucide-react';

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  return (
    <div className="space-y-4">
      {/* Stat cards — 2x2 grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label={t('critical')}
          value="0"
          color="red"
          gradient="gradient-kritiek"
        />
        <StatCard
          label={t('dueSoon')}
          value="0"
          color="amber"
          gradient="gradient-binnenkort"
        />
        <StatCard
          label={t('outstanding')}
          value="0"
          color="blue"
          gradient="gradient-openstaand"
        />
        <StatCard
          label={t('paid')}
          value="0"
          color="green"
          gradient="gradient-betaald"
        />
      </div>

      {/* Mijn schulden card */}
      <div className="bg-surface border border-border rounded-card p-3.5">
        <h2 className="text-section text-text">{t('myDebts')}</h2>
        <p className="text-hero text-text mt-1">&euro;0,00</p>
        <div className="flex items-center gap-1.5 mt-2">
          <Shield className="w-4 h-4 text-muted" />
          <span className="text-label text-muted">{t('savedEmpty')}</span>
        </div>
      </div>

      {/* Recent bills — empty state */}
      <div className="bg-surface border border-border rounded-card p-3.5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-section text-text">{t('recentBills')}</h2>
        </div>

        <div className="flex flex-col items-center py-8 px-4">
          <div className="w-12 h-12 rounded-full bg-blue-light flex items-center justify-center mb-3">
            <CreditCard className="w-6 h-6 text-muted" />
          </div>
          <p className="text-section text-text text-center">{t('noBills')}</p>
          <p className="text-[13px] text-muted text-center max-w-[280px] mt-1">
            {t('noBillsDescription')}
          </p>
          <div className="flex gap-2 mt-4">
            <button className="btn-press flex items-center gap-1.5 px-4 py-2.5 bg-blue text-white text-[13px] font-semibold rounded-btn">
              <Mail className="w-4 h-4" />
              Gmail
            </button>
            <button className="btn-press flex items-center gap-1.5 px-4 py-2.5 bg-surface text-text text-[13px] font-semibold rounded-btn border border-border">
              <Camera className="w-4 h-4" />
              Camera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ——— Stat Card component ——— */

interface StatCardProps {
  label: string;
  value: string;
  color: 'red' | 'amber' | 'blue' | 'green';
  gradient: string;
}

const ACCENT_COLORS: Record<StatCardProps['color'], string> = {
  red: 'border-t-red text-red',
  amber: 'border-t-amber text-amber',
  blue: 'border-t-blue text-blue',
  green: 'border-t-green text-green',
};

function StatCard({ label, value, color, gradient }: StatCardProps) {
  const accent = ACCENT_COLORS[color];

  return (
    <div
      className={`${gradient} border border-border border-t-[3px] ${accent.split(' ')[0]} rounded-card px-3.5 py-3`}
    >
      <p className="text-caption text-muted font-medium">{label}</p>
      <p className={`text-[24px] font-extrabold tracking-tight mt-0.5 ${accent.split(' ')[1]}`}>
        {value}
      </p>
    </div>
  );
}
