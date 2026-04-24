'use client';

import { useNativeInit } from '@/lib/native-init';

/**
 * Drop-in component that initializes native Capacitor plugins.
 * Add to the root app layout — renders nothing, just runs the init hook.
 */
export default function NativeShell() {
  useNativeInit();
  return null;
}
