'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { presets } from '@/lib/motion';

/**
 * iOS-style page transition wrapper using PayWatch motion system.
 * 
 * - Tab switches: instant cross-fade (0.12s)
 * - Sub-page push: iOS UIKit slide with parallax + scale
 * - Only active in native mode (web unaffected)
 */

const TAB_PATHS = ['/', '/dashboard', '/overzicht', '/betalingen', '/feed', '/statistieken', '/stats', '/community', '/cashflow'];

function isTabPath(path: string): boolean {
  return TAB_PATHS.some(tab => path === tab || path === tab + '/');
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const { Capacitor } = await import('@capacitor/core');
        setIsNative(Capacitor.isNativePlatform());
      } catch {}
    }
    check();
  }, []);

  const isTabSwitch = isTabPath(pathname) && isTabPath(prevPath.current);
  const isGoingDeeper = pathname.split('/').length > prevPath.current.split('/').length;

  useEffect(() => {
    prevPath.current = pathname;
  }, [pathname]);

  // Web mode: no animation wrapper
  if (!isNative) return <>{children}</>;

  // Tab switches: quick cross-fade
  if (isTabSwitch) {
    return (
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={pathname} {...presets.tabFade}>
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Sub-page: iOS push/pop with parallax
  const variants = isGoingDeeper ? presets.pagePush : presets.pagePop;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
