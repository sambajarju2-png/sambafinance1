'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/**
 * iOS-style page transition wrapper.
 * 
 * Behavior:
 * - Tab switches (dashboard ↔ rekeningen ↔ stats etc.): cross-fade (0.15s)
 * - Sub-page navigation (bills → bill detail): slide from right (0.3s)
 * - Back navigation: slide from left (0.3s)
 * 
 * Only active in native mode. On web, renders children without animation.
 */

// Root-level tab paths — transitions between these use a quick fade
const TAB_PATHS = ['/', '/dashboard', '/rekeningen', '/statistieken', '/community', '/cashflow'];

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

  // Determine animation direction
  const isTabSwitch = isTabPath(pathname) && isTabPath(prevPath.current);
  const isGoingDeeper = pathname.split('/').length > prevPath.current.split('/').length;

  useEffect(() => {
    prevPath.current = pathname;
  }, [pathname]);

  // Web mode: no animation wrapper
  if (!isNative) {
    return <>{children}</>;
  }

  // Tab switches: quick cross-fade
  if (isTabSwitch) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Sub-page: iOS push/pop slide
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ 
          x: isGoingDeeper ? '30%' : '-15%', 
          opacity: 0,
        }}
        animate={{ 
          x: 0, 
          opacity: 1,
        }}
        exit={{ 
          x: isGoingDeeper ? '-15%' : '30%', 
          opacity: 0,
        }}
        transition={{ 
          duration: 0.3, 
          ease: [0.25, 0.46, 0.45, 0.94], // iOS-like ease curve
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
