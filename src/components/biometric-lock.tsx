'use client';

import { useState, useEffect, useCallback } from 'react';
import { isBiometricEnabled, isBiometricAvailable, verifyBiometric, getBiometricLabel, type BiometryType } from '@/lib/biometric';
import { Fingerprint, ShieldCheck, Loader2 } from 'lucide-react';
import { useStatusBar } from '@/lib/use-status-bar';

/**
 * Full-screen biometric lock overlay.
 * Shows on app launch if Face ID is enabled.
 * Covers the entire app until biometric verification succeeds.
 * 
 * Renders in the root layout — sits on top of everything.
 */
export default function BiometricLock() {
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [biometryType, setBiometryType] = useState<BiometryType>('faceId');
  const [failed, setFailed] = useState(false);

  // Navy background — use light status bar text while locked
  useStatusBar(locked ? 'light' : 'dark');

  const attemptUnlock = useCallback(async () => {
    setFailed(false);
    const success = await verifyBiometric();
    if (success) {
      // Haptic feedback on successful unlock
      try {
        const { Haptics, NotificationType } = await import('@capacitor/haptics');
        await Haptics.notification({ type: NotificationType.Success });
      } catch {}
      setLocked(false);
    } else {
      setFailed(true);
      try {
        const { Haptics, NotificationType } = await import('@capacitor/haptics');
        await Haptics.notification({ type: NotificationType.Error });
      } catch {}
    }
  }, []);

  useEffect(() => {
    async function checkBiometric() {
      // Only check on native platforms
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) {
          setChecking(false);
          return;
        }
      } catch {
        setChecking(false);
        return;
      }

      // Check if biometric is enabled by the user
      if (!isBiometricEnabled()) {
        setChecking(false);
        return;
      }

      // Check if hardware is available
      const { available, type } = await isBiometricAvailable();
      if (!available) {
        setChecking(false);
        return;
      }

      setBiometryType(type);
      setLocked(true);
      setChecking(false);

      // Auto-prompt Face ID on launch
      const success = await verifyBiometric();
      if (success) {
        try {
          const { Haptics, NotificationType } = await import('@capacitor/haptics');
          await Haptics.notification({ type: NotificationType.Success });
        } catch {}
        setLocked(false);
      } else {
        setFailed(true);
      }
    }

    checkBiometric();
  }, []);

  // Don't render during initial check or when unlocked
  if (checking || !locked) return null;

  const label = getBiometricLabel(biometryType);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-pw-navy"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Logo */}
      <div className="mb-8">
        <img src="/icon-192.png" alt="PayWatch" className="h-20 w-20 rounded-2xl" />
      </div>

      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
        {biometryType === 'faceId' ? (
          <ShieldCheck className="h-10 w-10 text-white" strokeWidth={1.5} />
        ) : (
          <Fingerprint className="h-10 w-10 text-white" strokeWidth={1.5} />
        )}
      </div>

      {/* Text */}
      <h1 className="mb-2 text-xl font-bold text-white">PayWatch is vergrendeld</h1>
      <p className="mb-8 text-sm text-white/60">
        {failed ? `${label} niet herkend. Probeer opnieuw.` : `Gebruik ${label} om door te gaan`}
      </p>

      {/* Retry button */}
      <button
        onClick={attemptUnlock}
        className="flex items-center gap-2 rounded-full bg-white/15 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors active:bg-white/25"
      >
        {biometryType === 'faceId' ? (
          <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />
        ) : (
          <Fingerprint className="h-5 w-5" strokeWidth={1.5} />
        )}
        Ontgrendel met {label}
      </button>
    </div>
  );
}
