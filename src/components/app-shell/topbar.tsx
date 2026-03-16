'use client';

import { useTranslations } from 'next-intl';
import { Bell, Flame } from 'lucide-react';

interface TopbarProps {
  displayName: string;
  streakCurrent: number;
  notificationCount: number;
}

export default function Topbar({ displayName, streakCurrent, notificationCount }: TopbarProps) {
  const t = useTranslations('nav');

  // Extract first name for greeting
  const firstName = displayName?.split(' ')[0] || '';

  return (
    <header className="glass-topbar sticky top-0 z-40 flex h-14 items-center justify-between border-b border-pw-border/50 px-4">
      {/* Left: Logo + Greeting */}
      <div className="flex items-center gap-3">
        <span className="text-[15px] font-bold tracking-tight text-pw-navy">
          PayWatch
        </span>
        {firstName && (
          <span className="hidden text-body text-pw-muted sm:inline">
            Hoi, {firstName}
          </span>
        )}
      </div>

      {/* Right: Streak + Bell */}
      <div className="flex items-center gap-4">
        {/* Streak counter - only visible when streak > 0 */}
        {streakCurrent > 0 && (
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
            <span className="text-[14px] font-bold text-pw-blue">
              {streakCurrent}
            </span>
          </div>
        )}

        {/* Notification bell */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-input text-pw-muted transition-colors hover:bg-pw-border/30 hover:text-pw-text"
          aria-label={t('notifications')}
        >
          <Bell className="h-5 w-5" strokeWidth={1.5} />
          {notificationCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pw-red px-1 text-[10px] font-semibold text-white">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
