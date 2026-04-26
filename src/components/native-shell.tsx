'use client';

import { useEffect, useState } from 'react';
import { useNativeInit } from '@/lib/native-init';

/**
 * Initializes native Capacitor plugins and marks the body
 * so CSS/components can detect native mode.
 * 
 * Adds classes to <html>: 'native-app', 'is-ios' or 'is-android'
 * Hides PWA install prompts and web push prompts in native mode.
 */
export default function NativeShell() {
  useNativeInit();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    async function detect() {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          setIsNative(true);
          const platform = Capacitor.getPlatform();
          document.documentElement.classList.add('native-app');
          document.documentElement.classList.add(`is-${platform}`);
          // Prevent overscroll / pull-to-refresh
          document.body.style.overscrollBehavior = 'none';
          // Add safe area meta if not present
          const meta = document.querySelector('meta[name="viewport"]');
          if (meta && !meta.getAttribute('content')?.includes('viewport-fit')) {
            meta.setAttribute('content', meta.getAttribute('content') + ', viewport-fit=cover');
          }
        }
      } catch {}
    }
    detect();
  }, []);

  // When in native mode, render nothing — but block PWA/push prompts via context
  if (!isNative) return null;

  // Inject a style tag to hide web-only elements in native mode
  return (
    <style>{`
      .native-app .pwa-install-prompt,
      .native-app .pwa-badge,
      .native-app [data-pwa-only] {
        display: none !important;
      }
    `}</style>
  );
}
