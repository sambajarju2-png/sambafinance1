'use client';

import { useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User, Mail, BellRing, Wallet, HelpCircle, LogOut, ChevronRight, Loader2, Trophy } from 'lucide-react';
import GmailSettings from './gmail-settings';
import GemeenteSelector from '@/components/gemeente-selector';
import DarkModeToggle from '@/components/dark-mode-toggle';
import PushPermission from '@/components/push-permission';
import TestNotification from '@/components/test-notification';
import AchievementsDisplay from '@/components/achievements';

type SettingsTab = 'menu' | 'gmail' | 'profile' | 'notifications' | 'achievements';

export default function InstellingenPage() {
  const t = useTranslations('settings');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('menu');
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  if (activeTab === 'gmail') {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setActiveTab('menu')} />
        <Suspense fallback={<div className="skeleton h-[200px] rounded-card" />}>
          <GmailSettings />
        </Suspense>
      </div>
    );
  }

  if (activeTab === 'profile') {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setActiveTab('menu')} />
        <h2 className="text-heading text-pw-navy">{t('profile')}</h2>
        <GemeenteSelector />
        <DarkModeToggle />
      </div>
    );
  }

  if (activeTab === 'notifications') {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setActiveTab('menu')} />
        <h2 className="text-heading text-pw-navy">{t('notifications')}</h2>
        <PushPermission />
        <TestNotification />
      </div>
    );
  }

  if (activeTab === 'achievements') {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setActiveTab('menu')} />
        <h2 className="text-heading text-pw-navy">Prestaties</h2>
        <AchievementsDisplay />
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <p className="text-[12px] text-pw-muted">
            Verdien prestaties door rekeningen op tijd te betalen, je Gmail te koppelen, en meer. Vergrendelde badges worden ontgrendeld als je de voorwaarde hebt bereikt.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>
      <div className="space-y-2">
        <SettingsLink icon={User} label={t('profile')} description={t('profileDesc')} onClick={() => setActiveTab('profile')} />
        <SettingsLink icon={Mail} label={t('gmailAccounts')} description={t('gmailAccountsDesc')} onClick={() => setActiveTab('gmail')} />
        <SettingsLink icon={BellRing} label={t('notifications')} description={t('notificationsDesc')} onClick={() => setActiveTab('notifications')} />
        <SettingsLink icon={Trophy} label="Prestaties" description="Bekijk je verdiende badges en prestaties" onClick={() => setActiveTab('achievements')} />
        <SettingsLink icon={Wallet} label={t('budget')} description={t('budgetDesc')} onClick={() => {}} />
        <SettingsLink icon={HelpCircle} label={t('debtHelp')} description={t('debtHelpDesc')} onClick={() => {}} />
      </div>
      <div className="pt-4">
        <button onClick={handleSignOut} disabled={signingOut}
          className="btn-press flex w-full items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-red transition-colors hover:border-pw-red/30 hover:bg-red-50 disabled:opacity-50">
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <LogOut className="h-4 w-4" strokeWidth={1.5} />}
          {tAuth('signOut')}
        </button>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[13px] font-semibold text-pw-blue">
      <ChevronRight className="h-4 w-4 rotate-180" strokeWidth={1.5} />
      Terug
    </button>
  );
}

function SettingsLink({ icon: Icon, label, description, onClick }: { icon: React.ElementType; label: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-4 py-3.5 text-left transition-colors hover:bg-pw-bg">
      <div className="flex h-9 w-9 items-center justify-center rounded-input bg-pw-bg">
        <Icon className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-pw-text">{label}</p>
        <p className="text-[11px] text-pw-muted">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
    </button>
  );
}
