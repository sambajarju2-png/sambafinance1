import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';

export default function StatsPage() {
  const t = useTranslations('nav');

  return (
    <div>
      <h1 className="text-heading text-text mb-4">{t('stats')}</h1>
      <div className="flex flex-col items-center py-12 px-4">
        <TrendingUp className="w-12 h-12 text-muted mb-3" />
        <p className="text-body text-muted text-center">
          Statistieken worden beschikbaar zodra je rekeningen hebt.
        </p>
      </div>
    </div>
  );
}
