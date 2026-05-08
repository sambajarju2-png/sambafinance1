'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

interface Props {
  userId: string;
  plan?: string;
  gemeente?: string;
}

export default function PostHogIdentify({ userId, plan, gemeente }: Props) {
  useEffect(() => {
    if (!userId || !posthog || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.identify(userId, {
      plan: plan || 'gratis',
      ...(gemeente ? { gemeente } : {}),
    });
  }, [userId, plan, gemeente]);

  return null;
}
