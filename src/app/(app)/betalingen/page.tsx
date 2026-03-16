import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';

export default function BetalingenPage() {
  const t = useTranslations('bills');

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('pageTitle')}</h1>

      {/* Tab filter pills */}
      <div className="flex gap-1.5 rounded-input bg-pw-border/50 p-1">
        <TabPill label={t('outstanding')} active />
        <TabPill label={t('upcoming')} />
        <TabPill label={t('overdue')} />
        <TabPill label={t('paid')} />
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center py-16 text-center">
        <CreditCard className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
        <h2 className="text-[16px] font-semibold text-pw-text">{t('noBills')}</h2>
        <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">
          {t('noBillsHint')}
        </p>
      </div>
    </div>
  );
}

function TabPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      className={`flex-1 rounded-[6px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        active
          ? 'bg-pw-surface text-pw-text shadow-sm'
          : 'text-pw-muted hover:text-pw-text'
      }`}
    >
      {label}
    </button>
  );
}
