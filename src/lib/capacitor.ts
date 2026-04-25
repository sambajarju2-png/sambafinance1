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
        setPlatform('web');
        setIsNative(false);
      }
    }
    detect();
  }, []);

  return { platform, isNative, isIOS: platform === 'ios', isAndroid: platform === 'android' };
}

// ─── Semantic Haptics ─────────────────────────────────────────
// Every haptic in the app should go through these semantic functions.
// This ensures consistency and makes it trivial to tune feedback globally.

/**
 * Impact haptic — for physical interactions (taps, presses)
 */
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] });
  } catch {}
}

/**
 * Selection haptic — for switches, toggles, tab changes, picker wheels.
 * This is the lightest feedback — a tiny tick.
 */
export async function hapticSelection() {
  try {
    const { Haptics } = await import('@capacitor/haptics');
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {}
}

/**
 * Notification haptic — for outcome feedback (success, warning, error)
 */
export async function hapticNotification(type: 'success' | 'warning' | 'error') {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    const map = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: map[type] });
  } catch {}
}

/**
 * Semantic haptic shorthand — call by intent, not by type.
 * This is the primary API for the rest of the app.
 * 
 * Usage:
 *   haptic('tap')        → light impact (button press)
 *   haptic('select')     → selection (toggle, tab switch, picker)
 *   haptic('confirm')    → medium impact (bill added, edited)
 *   haptic('success')    → notification success (bill paid, scan complete)
 *   haptic('warning')    → notification warning (overdue alert)
 *   haptic('error')      → notification error (validation fail)
 *   haptic('heavy')      → heavy impact (destructive action, force gesture)
 */
export async function haptic(
  intent: 'tap' | 'select' | 'confirm' | 'success' | 'warning' | 'error' | 'heavy'
) {
  switch (intent) {
    case 'tap':
      return hapticImpact('light');
    case 'select':
      return hapticSelection();
    case 'confirm':
      return hapticImpact('medium');
    case 'success':
      return hapticNotification('success');
    case 'warning':
      return hapticNotification('warning');
    case 'error':
      return hapticNotification('error');
    case 'heavy':
      return hapticImpact('heavy');
  }
}

// ─── Legacy alias (backward compatible) ───────────────────────
export const hapticFeedback = hapticImpact;

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
    } catch {}
  }
  return '';
}
