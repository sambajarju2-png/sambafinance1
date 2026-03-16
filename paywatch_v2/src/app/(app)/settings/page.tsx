'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Mail,
  Bell,
  Wallet,
  HelpCircle,
  LogOut,
  ChevronRight,
} from 'lucide-react';

const MENU_ITEMS = [
  { key: 'profile', icon: User },
  { key: 'gmail', icon: Mail },
  { key: 'notifications', icon: Bell },
  { key: 'budget', icon: Wallet },
  { key: 'help', icon: HelpCircle },
] as const;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-heading text-text mb-4">{t('title')}</h1>

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {MENU_ITEMS.map(({ key, icon: Icon }, index) => (
          <button
            key={key}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-bg/50 transition-colors"
          >
            <Icon className="w-5 h-5 text-muted" strokeWidth={1.5} />
            <span className="flex-1 text-body text-text">
              {t(key as 'profile' | 'gmail' | 'notifications' | 'budget' | 'help')}
            </span>
            <ChevronRight className="w-4 h-4 text-muted" />
          </button>
        ))}
      </div>

      {/* Logout button */}
      <button
        onClick={handleLogout}
        className="btn-press w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 bg-surface text-red text-[13px] font-semibold rounded-btn border border-border"
      >
        <LogOut className="w-4 h-4" />
        {t('title') === 'Instellingen' ? 'Uitloggen' : 'Log out'}
      </button>
    </div>
  );
}
