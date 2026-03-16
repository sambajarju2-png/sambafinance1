import { useTranslations } from 'next-intl';
import { ArrowDownUp } from 'lucide-react';

export default function CashflowPage() {
  const t = useTranslations('cashflow');

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>

      {/* Empty state */}
      <div className="flex flex-col items-center py-16 text-center">
        <ArrowDownUp className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
        <h2 className="text-[16px] font-semibold text-pw-text">{t('noData')}</h2>
        <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">
          {t('noDataHint')}
        </p>
      </div>
    </div>
  );
}
