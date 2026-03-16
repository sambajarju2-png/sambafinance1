import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';

export default function BillsPage() {
  const t = useTranslations('bills');

  return (
    <div>
      <h1 className="text-heading text-text mb-4">{t('title')}</h1>

      {/* Filter tabs placeholder */}
      <div className="flex gap-1 p-1 bg-border/50 rounded-segment mb-4">
        {['outstanding', 'dueSoon', 'overdue', 'paid'].map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-1.5 text-label rounded-[6px] transition-colors ${
              tab === 'outstanding'
                ? 'bg-surface text-text font-semibold shadow-sm'
                : 'text-muted'
            }`}
          >
            {t(tab as 'outstanding' | 'dueSoon' | 'overdue' | 'paid')}
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center py-12 px-4">
        <CreditCard className="w-12 h-12 text-muted mb-3" />
        <p className="text-section text-text text-center">
          {t('outstanding')}: 0
        </p>
      </div>
    </div>
  );
}
