import { useTranslations } from 'next-intl';
import { Shield } from 'lucide-react';
import SignOutButton from './sign-out-button';

export default function AuthenticatedHome() {
  const t = useTranslations('home');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-pw-bg px-6">
      <div className="flex flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-pw-blue">
          <Shield className="h-8 w-8 text-white" strokeWidth={1.5} />
        </div>

        <h1 className="text-hero text-pw-navy">PayWatch</h1>

        <p className="mt-2 max-w-sm text-body text-pw-muted">
          {t('tagline')}
        </p>

        {/* Auth status badge */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-pw-border bg-pw-surface px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-pw-green" />
          <span className="text-label text-pw-text">{t('authenticated')}</span>
        </div>

        {/* Sign out */}
        <div className="mt-6">
          <SignOutButton />
        </div>

        {/* Next step info */}
        <p className="mt-8 text-tiny text-pw-muted">
          {t('nextStep')}
        </p>
      </div>
    </main>
  );
}
