'use client';

import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  User,
  Mail,
  BellRing,
  Wallet,
  HelpCircle,
  LogOut,
  ChevronRight,
  Loader2,
} from 'lucide-react';

export default function InstellingenPage() {
  const t = useTranslations('settings');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>

      {/* Settings sections */}
      <div className="space-y-2">
        <SettingsLink
          icon={User}
          label={t('profile')}
          description={t('profileDesc')}
        />
        <SettingsLink
          icon={Mail}
          label={t('gmailAccounts')}
          description={t('gmailAccountsDesc')}
        />
        <SettingsLink
          icon={BellRing}
          label={t('notifications')}
          description={t('notificationsDesc')}
        />
        <SettingsLink
          icon={Wallet}
          label={t('budget')}
          description={t('budgetDesc')}
        />
        <SettingsLink
          icon={HelpCircle}
          label={t('debtHelp')}
          description={t('debtHelpDesc')}
        />
      </div>

      {/* Sign out button */}
      <div className="pt-4">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="btn-press flex w-full items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-red transition-colors hover:border-pw-red/30 hover:bg-red-50 disabled:opacity-50"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
          )}
          {tAuth('signOut')}
        </button>
      </div>
    </div>
  );
}

function SettingsLink({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  description: string;
}) {
  return (
    <button className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-4 py-3 text-left transition-colors hover:bg-gray-50">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-input bg-pw-bg">
        <Icon className="h-[18px] w-[18px] text-pw-muted" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-pw-text">{label}</p>
        <p className="text-[11px] text-pw-muted">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-pw-muted/50" strokeWidth={1.5} />
    </button>
  );
}
