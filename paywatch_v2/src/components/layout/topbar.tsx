'use client';

import { useTranslations } from 'next-intl';
import { Flame, Bell } from 'lucide-react';

interface TopbarProps {
  displayName: string;
  streakDays: number;
  notificationCount: number;
}

export function Topbar({ displayName, streakDays, notificationCount }: TopbarProps) {
  const t = useTranslations('topbar');

  return (
    <header className="sticky top-0 z-40 glass border-b border-border/50 px-4 h-14 flex items-center gap-3">
      {/* Logo */}
      <span className="text-section text-navy tracking-tight">PayWatch</span>

      {/* Greeting */}
      <span className="text-body text-muted ml-1">
        {t('greeting', { name: displayName })}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Streak counter — only if > 0 */}
      {streakDays > 0 ? (
        <div className="flex items-center gap-1">
          <Flame className="w-4 h-4 text-blue" />
          <span className="text-body font-bold text-blue">{streakDays}</span>
        </div>
      ) : null}

      {/* Notification bell */}
      <button
        className="relative p-1"
        aria-label={t('notifications')}
      >
        <Bell className="w-5 h-5 text-muted" />
        {notificationCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red text-white text-[10px] font-bold rounded-full">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        ) : null}
      </button>
    </header>
  );
}
