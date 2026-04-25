'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { haptic } from '@/lib/capacitor';
import {
  LayoutDashboard,
  CreditCard,
  Users,
  TrendingUp,
  MessageCircle,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/overzicht', icon: LayoutDashboard, labelKey: 'overview' as const, isFeed: false },
  { href: '/betalingen', icon: CreditCard, labelKey: 'payments' as const, isFeed: false },
  { href: '/feed', icon: Users, labelKey: 'feed' as const, isFeed: true },
  { href: '/stats', icon: TrendingUp, labelKey: 'stats' as const, isFeed: false },
  { href: '/buddy', icon: MessageCircle, labelKey: 'buddy' as const, isFeed: false },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  function isActive(href: string): boolean {
    if (href === '/overzicht') {
      return pathname === '/overzicht';
    }
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="bottom-nav-container fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-pw-border/60"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        paddingTop: '6px',
        background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;

        if (item.isFeed) {
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => haptic('select')}
              className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  active
                    ? 'bg-pw-blue shadow-md shadow-pw-blue/30'
                    : 'bg-pw-blue'
                }`}
              >
                <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
              </div>
              <span
                className={`text-[10px] font-medium ${
                  active ? 'text-pw-blue' : 'text-pw-muted'
                }`}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => haptic('select')}
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1"
          >
            <Icon
              className={`h-6 w-6 ${active ? 'text-pw-blue' : 'text-pw-muted'}`}
              strokeWidth={1.5}
            />
            <span
              className={`text-[10px] font-medium ${
                active ? 'text-pw-blue' : 'text-pw-muted'
              }`}
            >
              {t(item.labelKey)}
            </span>
            {active && <div className="nav-active-dot" />}
          </Link>
        );
      })}
    </nav>
  );
}
