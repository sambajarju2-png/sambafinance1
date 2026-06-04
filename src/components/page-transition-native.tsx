'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef } from 'react';
import { presets } from '@/lib/motion';

/**
 * Native (Capacitor) page-transition animations.
 *
 * Split out of PageTransition so that Framer Motion is ONLY downloaded inside
 * the iOS/Android app (where these transitions run). On the web this module is
 * never imported, keeping the animation library off the critical path.
 *
 * - Tab switches: instant cross-fade (0.12s)
 * - Sub-page push: iOS UIKit slide with parallax + scale
 */

const TAB_PATHS = ['/', '/dashboard', '/overzicht', '/betalingen', '/feed', '/statistieken', '/stats', '/community', '/cashflow'];

function isTabPath(path: string): boolean {
  return TAB_PATHS.some(tab => path === tab || path === tab + '/');
}

export default function NativePageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  const isTabSwitch = isTabPath(pathname) && isTabPath(prevPath.current);
  const isGoingDeeper = pathname.split('/').length > prevPath.current.split('/').length;

  useEffect(() => {
    prevPath.current = pathname;
  }, [pathname]);

  // Tab switches: quick cross-fade
  if (isTabSwitch) {
    return (
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={pathname} {...presets.tabFade} className="bg-pw-bg">
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
        className="bg-pw-bg"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
