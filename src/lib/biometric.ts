'use client';

/**
 * Biometric authentication wrapper for Capacitor iOS.
 * Uses capacitor-native-biometric for Face ID / Touch ID.
 * 
 * Flow:
 * - After login, user can enable biometric lock
 * - On app launch, if enabled, shows lock screen requiring Face ID
 * - Settings page allows toggling on/off
 * 
 * Storage: localStorage key 'paywatch-biometric-enabled'
 * The biometric check is purely an access gate — session management 
 * stays in Supabase cookies (no tokens stored in Keychain).
 */

const BIOMETRIC_KEY = 'paywatch-biometric-enabled';

export type BiometryType = 'faceId' | 'touchId' | 'iris' | 'none';

/**
 * Check if biometric hardware is available on this device.
 */
export async function isBiometricAvailable(): Promise<{
  available: boolean;
  type: BiometryType;
}> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return { available: false, type: 'none' };
    }

    const { NativeBiometric } = await import('capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable();

    const typeMap: Record<number, BiometryType> = {
      1: 'touchId',
      2: 'faceId',
      3: 'iris',
    };

    return {
      available: result.isAvailable,
      type: typeMap[result.biometryType] || 'none',
    };
  } catch {
    return { available: false, type: 'none' };
  }
}

/**
 * Prompt the user for biometric authentication (Face ID / Touch ID).
 * Returns true if verification succeeded, false if failed/cancelled.
 */
export async function verifyBiometric(reason?: string): Promise<boolean> {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    await NativeBiometric.verifyIdentity({
      reason: reason || 'Ontgrendel PayWatch',
      title: 'PayWatch',
      subtitle: 'Gebruik Face ID om door te gaan',
      useFallback: true,
      fallbackTitle: 'Gebruik toegangscode',
      maxAttempts: 3,
    });
    return true;
  } catch {
    // User cancelled or verification failed
    return false;
  }
}

/**
 * Check if the user has enabled biometric lock.
 */
export function isBiometricEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BIOMETRIC_KEY) === 'true';
}

/**
 * Enable biometric lock.
 */
export function enableBiometric(): void {
  localStorage.setItem(BIOMETRIC_KEY, 'true');
}

/**
 * Disable biometric lock.
 */
export function disableBiometric(): void {
  localStorage.removeItem(BIOMETRIC_KEY);
}

/**
 * Get a human-readable label for the biometric type.
 */
export function getBiometricLabel(type: BiometryType): string {
  switch (type) {
    case 'faceId': return 'Face ID';
    case 'touchId': return 'Touch ID';
    case 'iris': return 'Iris';
    default: return 'Biometrisch';
  }
}
