import { useTranslations } from 'next-intl';
import { Shield } from 'lucide-react';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-pw-bg px-6">
      <div className="flex flex-col items-center text-center">
        {/* Logo / Shield Icon */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue">
          <Shield className="h-8 w-8 text-white" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 className="text-hero text-pw-navy">PayWatch</h1>

        {/* Tagline */}
        <p className="mt-2 max-w-sm text-body text-pw-muted">
          {t('tagline')}
        </p>

        {/* Version Badge */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-pw-border bg-pw-surface px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-pw-green" />
          <span className="text-label text-pw-text">v2.0 — {t('status')}</span>
        </div>

        {/* Tech Stack Confirmation */}
        <div className="mt-8 grid grid-cols-2 gap-3 text-tiny text-pw-muted">
          <span>Next.js 14</span>
          <span>TypeScript</span>
          <span>Tailwind CSS</span>
          <span>Supabase</span>
          <span>next-intl</span>
          <span>Plus Jakarta Sans</span>
        </div>
      </div>
    </main>
  );
}
