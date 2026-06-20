'use client';

import { useEffect, useState } from 'react';
import { allFeaturesTrue, type FeatureFlag } from './org-features';

/**
 * Returns the user's effective org-granted features (enforcement already applied server-side).
 * Fail-open: defaults to all-granted while loading and on error, so a transient failure can
 * never accidentally hide a feature from the user.
 */
export function useOrgFeatures(): { features: Record<FeatureFlag, boolean>; loading: boolean } {
  const [features, setFeatures] = useState<Record<FeatureFlag, boolean>>(allFeaturesTrue());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/org-features')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.granted) setFeatures(d.granted);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { features, loading };
}
