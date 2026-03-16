'use client';

import { useTranslations } from 'next-intl';
import { Shield } from 'lucide-react';

export default function HomePage() {
  const t = useTranslations('common');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Shield className="h-10 w-10 text-blue" strokeWidth={1.5} />
          <h1 className="text-[32px] font-extrabold tracking-tight text-navy">
            PayWatch
          </h1>
        </div>

        {/* Tagline */}
        <p className="max-w-[320px] text-body text-muted">
          {t('tagline')}
        </p>

        {/* Status badge */}
        <div className="flex items-center gap-2 rounded-badge border border-border bg-surface px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-green" />
          <span className="text-label text-muted">
            {t('scaffoldReady')}
          </span>
        </div>

        {/* Design system preview: stat cards */}
        <div className="mt-6 grid w-full max-w-[340px] grid-cols-2 gap-2">
          <div className="gradient-kritiek rounded-card border border-border p-3">
            <p className="text-caption text-muted">{t('statKritiek')}</p>
            <p className="text-[24px] font-extrabold text-red">0</p>
          </div>
          <div className="gradient-binnenkort rounded-card border border-border p-3">
            <p className="text-caption text-muted">{t('statBinnenkort')}</p>
            <p className="text-[24px] font-extrabold text-amber">0</p>
          </div>
          <div className="gradient-openstaand rounded-card border border-border p-3">
            <p className="text-caption text-muted">{t('statOpenstaand')}</p>
            <p className="text-[24px] font-extrabold text-blue">0</p>
          </div>
          <div className="gradient-betaald rounded-card border border-border p-3">
            <p className="text-caption text-muted">{t('statBetaald')}</p>
            <p className="text-[24px] font-extrabold text-green">0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
