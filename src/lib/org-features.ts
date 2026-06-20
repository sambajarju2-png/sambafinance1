/**
 * PayWatch — org feature flags + effective-feature resolver (CONSUMER COPY).
 *
 * DUPLICATED from the monorepo's @paywatch/config (packages/config/src/org-features.ts).
 * The consumer app is a separate repo and can't import the workspace package, so this file
 * MUST be kept in sync with that one — specifically FEATURE_FLAGS, the tier ceilings, and
 * the getEffectiveFeatures semantics.
 *
 * Model: tier = the ceiling (what an org is entitled to); the per-org `features` jsonb is an
 * on/off toggle WITHIN the ceiling; a feature is effective iff the tier includes it AND the
 * org toggled it on.
 */

export type FeatureFlag =
  | 'buddy_system' | 'ai_insights' | 'camera_scan' | 'payment_plans' | 'push_notifications'
  | 'escalation_alerts' | 'spending_analytics' | 'export_reports' | 'bank_sync' | 'community'
  | 'api_access' | 'custom_branding' | 'audit_log' | 'webhooks' | 'white_label';

export const FEATURE_FLAGS: FeatureFlag[] = [
  'buddy_system', 'ai_insights', 'camera_scan', 'payment_plans', 'push_notifications',
  'escalation_alerts', 'spending_analytics', 'export_reports', 'bank_sync', 'community',
  'api_access', 'custom_branding', 'audit_log', 'webhooks', 'white_label',
];

type Tier = 'pilot' | 'professional' | 'enterprise';

/** Keep in sync with @paywatch/config TIERS[*].features. */
const TIER_CEILINGS: Record<Tier, Partial<Record<FeatureFlag, boolean>>> = {
  pilot: {
    buddy_system: true, camera_scan: true, payment_plans: true,
    push_notifications: true, escalation_alerts: true,
  },
  professional: {
    buddy_system: true, ai_insights: true, camera_scan: true, payment_plans: true,
    push_notifications: true, escalation_alerts: true, spending_analytics: true,
    export_reports: true, api_access: true, audit_log: true, webhooks: true,
  },
  enterprise: {
    buddy_system: true, ai_insights: true, camera_scan: true, payment_plans: true,
    push_notifications: true, escalation_alerts: true, spending_analytics: true,
    export_reports: true, bank_sync: true, community: true, api_access: true,
    custom_branding: true, audit_log: true, webhooks: true, white_label: true,
  },
};

function tierIncludes(tier: string | null | undefined, flag: FeatureFlag): boolean {
  const ceiling = (TIER_CEILINGS as Record<string, Partial<Record<FeatureFlag, boolean>>>)[tier as Tier] ?? TIER_CEILINGS.pilot;
  return ceiling[flag] === true;
}

export interface OrgFeatureSource {
  tier?: string | null;
  features?: Partial<Record<FeatureFlag, boolean>> | null;
}

/** Effective features for one org = tier ceiling AND per-org toggle. */
export function getEffectiveFeatures(org: OrgFeatureSource): Record<FeatureFlag, boolean> {
  const out = {} as Record<FeatureFlag, boolean>;
  for (const flag of FEATURE_FLAGS) {
    out[flag] = tierIncludes(org.tier, flag) && org.features?.[flag] === true;
  }
  return out;
}

export function allFeaturesTrue(): Record<FeatureFlag, boolean> {
  const out = {} as Record<FeatureFlag, boolean>;
  for (const flag of FEATURE_FLAGS) out[flag] = true;
  return out;
}

function allFeaturesFalse(): Record<FeatureFlag, boolean> {
  const out = {} as Record<FeatureFlag, boolean>;
  for (const flag of FEATURE_FLAGS) out[flag] = false;
  return out;
}

/**
 * The user's effective org-granted features (GRANT model): the union of effective features
 * across every org the user is actively connected to. `connected` is false when the user has
 * no active org link — in that case org gating does not apply (their plan governs).
 */
export async function getUserOrgFeatures(
  supabase: any,
  userId: string,
): Promise<{ connected: boolean; granted: Record<FeatureFlag, boolean> }> {
  const { data: links } = await supabase
    .from('user_organizations')
    .select('organization_id')
    .eq('user_id', userId)
    .in('status', ['active', 'onboarded']);

  if (!links || links.length === 0) {
    return { connected: false, granted: allFeaturesTrue() };
  }

  const orgIds = links.map((l: { organization_id: string }) => l.organization_id);
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, tier, features')
    .in('id', orgIds);

  const granted = allFeaturesFalse();
  for (const org of (orgs || []) as OrgFeatureSource[]) {
    const eff = getEffectiveFeatures(org);
    for (const flag of FEATURE_FLAGS) {
      if (eff[flag]) granted[flag] = true;
    }
  }
  return { connected: true, granted };
}
