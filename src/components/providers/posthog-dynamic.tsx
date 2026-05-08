'use client';

import dynamic from 'next/dynamic';

// Provider is SSR-safe (just wraps children in context)
export { PostHogProvider as PostHogProviderDynamic } from './posthog-provider';

// PageView uses useSearchParams which triggers CSR bailout
export const PostHogPageViewDynamic = dynamic(
  () => import('./posthog-provider').then(m => ({ default: m.PostHogPageView })),
  { ssr: false }
);
