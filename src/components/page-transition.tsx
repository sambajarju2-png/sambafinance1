'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

/**
 * Page transition wrapper.
 *
 * On the web this is a pure pass-through (no animation, no Framer Motion).
 * On native (Capacitor) it lazy-loads the iOS-style transition component, so
 * the animation library is only ever downloaded inside the app — never on the
 * web critical path.
 */

const NativePageTransition = dynamic(() => import('./page-transition-native'), {
  ssr: false,
});

export default function PageTransition({ children }: { children: React.ReactNode }) {
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

  // Web (and first paint on native): render children directly with no wrapper.
  if (!isNative) return <>{children}</>;

  return <NativePageTransition>{children}</NativePageTransition>;
}
