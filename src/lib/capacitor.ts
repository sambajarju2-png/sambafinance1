'use client';

import { useEffect, useState } from 'react';

export type Platform = 'web' | 'ios' | 'android';

/**
 * Detect if the app is running inside a Capacitor native shell.
 * Uses dynamic import to avoid bundling Capacitor in web builds.
 */
export function useCapacitor() {
  const [platform, setPlatform] = useState<Platform>('web');
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    async function detect() {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const plt = Capacitor.getPlatform() as Platform;
        setPlatform(plt);
        setIsNative(Capacitor.isNativePlatform());
      } catch {
        // Not running in Capacitor — web mode
        setPlatform('web');
        setIsNative(false);
      }
    }
    detect();
  }, []);

  return { platform, isNative, isIOS: platform === 'ios', isAndroid: platform === 'android' };
}

/**
 * Trigger native haptic feedback if available.
 * Falls back silently on web.
 */
export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] });
  } catch {
    // Web — no haptics available
  }
}

/**
 * Get the API base URL.
 * On web, relative URLs work. On native, we need the full backend URL.
 */
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Capacitor } = require('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        return 'https://app.paywatch.app';
      }
    } catch {
      // Not in Capacitor
    }
  }
  return '';
}
