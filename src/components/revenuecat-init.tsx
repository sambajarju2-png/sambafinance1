'use client';

import { useEffect } from 'react';
import { initRevenueCat } from '@/lib/revenuecat';

export default function RevenueCatInit({ userId }: { userId: string }) {
  useEffect(() => {
    if (userId) {
      initRevenueCat(userId);
    }
  }, [userId]);

  return null; // invisible — just initializes SDK
}
