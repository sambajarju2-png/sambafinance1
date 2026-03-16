import { useTranslations } from 'next-intl';
import { ArrowDownUp } from 'lucide-react';

export default function CashflowPage() {
  const t = useTranslations('nav');

  return (
    <div>
      <h1 className="text-heading text-text mb-4">{t('cashflow')}</h1>
      <div className="flex flex-col items-center py-12 px-4">
        <ArrowDownUp className="w-12 h-12 text-muted mb-3" />
        <p className="text-body text-muted text-center">
          Cashflow-overzicht wordt beschikbaar zodra je rekeningen hebt.
        </p>
      </div>
    </div>
  );
}
