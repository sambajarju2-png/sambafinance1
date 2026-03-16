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
  { key: 'overview', href: '/dashboard', icon: LayoutDashboard },
  { key: 'payments', href: '/bills', icon: CreditCard },
  { key: 'stats', href: '/stats', icon: TrendingUp },
  { key: 'cashflow', href: '/cashflow', icon: ArrowDownUp },
  { key: 'more', href: '/settings', icon: MoreHorizontal },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border flex justify-around pb-[max(16px,env(safe-area-inset-bottom))] pt-1.5">
      {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={key}
            href={href}
            className="flex flex-col items-center justify-center min-w-0 flex-1 min-h-[56px] gap-0.5"
          >
            <Icon
              className={`w-6 h-6 ${isActive ? 'text-blue' : 'text-muted'}`}
              strokeWidth={1.5}
            />
            <span
              className={`text-[10px] font-medium ${
                isActive ? 'text-blue' : 'text-muted'
              }`}
            >
              {t(key)}
            </span>
            {/* Active indicator dot */}
            {isActive ? (
              <span className="w-1 h-1 rounded-full bg-blue" />
            ) : (
              <span className="w-1 h-1" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
