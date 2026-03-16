'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  ArrowDownUp,
  MoreHorizontal,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, labelKey: 'overview' as const },
  { href: '/betalingen', icon: CreditCard, labelKey: 'payments' as const },
  { href: '/stats', icon: TrendingUp, labelKey: 'stats' as const },
  { href: '/cashflow', icon: ArrowDownUp, labelKey: 'cashflow' as const },
  { href: '/instellingen', icon: MoreHorizontal, labelKey: 'settings' as const },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  function isActive(href: string): boolean {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-pw-border bg-pw-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)', paddingTop: '6px' }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
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
            {/* Active indicator dot */}
            {active && <span className="nav-active-dot" />}
          </Link>
        );
      })}
    </nav>
  );
}
