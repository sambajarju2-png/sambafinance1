import { useEffect } from 'react';

/**
 * Per-page status bar style.
 * iOS apps switch status bar per screen:
 * - 'dark' text on light backgrounds (default)
 * - 'light' text on dark backgrounds (voice call, biometric lock)
 * 
 * Usage:
 *   useStatusBar('light') // in voice-call.tsx
 *   useStatusBar('dark')  // default in (app)/layout.tsx
 */
export function useStatusBar(style: 'light' | 'dark') {
  useEffect(() => {
    let mounted = true;

    async function setStyle() {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || !mounted) return;
        
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({
          style: style === 'light' ? Style.Dark : Style.Light,
          // Note: Style.Dark = light text (for dark backgrounds)
          // Style.Light = dark text (for light backgrounds)
        });
      } catch {
        // Not on native, ignore
      }
    }

    setStyle();
    return () => { mounted = false; };
  }, [style]);
}
