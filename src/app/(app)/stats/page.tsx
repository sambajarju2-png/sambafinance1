import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';

export default function StatsPage() {
  const t = useTranslations('stats');

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>

      {/* Sub-tabs: Charts | AI Inzicht */}
      <div className="flex gap-1.5 rounded-input bg-pw-border/50 p-1">
        <button className="flex-1 rounded-[6px] bg-pw-surface px-3 py-1.5 text-[12px] font-semibold text-pw-text shadow-sm">
          {t('charts')}
        </button>
        <button className="flex-1 rounded-[6px] px-3 py-1.5 text-[12px] font-semibold text-pw-muted hover:text-pw-text">
          {t('aiInsight')}
        </button>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center py-16 text-center">
        <TrendingUp className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
        <h2 className="text-[16px] font-semibold text-pw-text">{t('noData')}</h2>
        <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">
          {t('noDataHint')}
        </p>
      </div>
    </div>
  );
}
