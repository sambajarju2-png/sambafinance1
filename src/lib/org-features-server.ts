import { getUserOrgFeatures, allFeaturesTrue, type FeatureFlag } from './org-features';

/**
 * Whether org-feature enforcement is live. OFF during the free-access period — mirrors the
 * ENFORCE_VOICE_LIMITS pattern. Set ENFORCE_ORG_FEATURES=true in Vercel env when you want
 * the b2b org toggles to actually gate connected users.
 */
export const ENFORCE_ORG_FEATURES = process.env.ENFORCE_ORG_FEATURES === 'true';

/**
 * The feature map a user effectively has, with enforcement applied:
 *   - enforcement OFF      -> everything granted (no-op; nothing changes for live users)
 *   - not org-connected    -> everything granted (their plan governs; org gating doesn't apply)
 *   - connected + enforce  -> union of their orgs' effective features (grant model)
 *
 * Callers gate a feature with `granted[flag] === true`.
 */
export async function getGrantedFeatures(
  supabase: any,
  userId: string,
): Promise<Record<FeatureFlag, boolean>> {
  if (!ENFORCE_ORG_FEATURES) return allFeaturesTrue();
  const state = await getUserOrgFeatures(supabase, userId);
  if (!state.connected) return allFeaturesTrue();
  return state.granted;
}
