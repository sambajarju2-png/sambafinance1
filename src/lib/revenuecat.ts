/**
 * RevenueCat helper — initializes Purchases SDK and exposes helpers.
 * Only runs on native (iOS) — web uses Stripe.
 */

let initialized = false;

export async function initRevenueCat(userId: string) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    if (initialized) return;

    const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');

    if (process.env.NODE_ENV === 'development') {
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    }

    const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY;
    if (!apiKey) {
      console.warn('[RevenueCat] NEXT_PUBLIC_REVENUECAT_IOS_API_KEY not set');
      return;
    }

    await Purchases.configure({ apiKey });

    // Link RevenueCat user to Supabase user_id
    await Purchases.logIn({ appUserID: userId });

    initialized = true;
    console.log('[RevenueCat] Initialized for user:', userId);
  } catch (err) {
    console.error('[RevenueCat] Init error:', err);
  }
}

/** Check if user has active pro or premium entitlement (iOS only) */
export async function getRevenueCatEntitlement(): Promise<'pro' | 'premium' | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;

    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();

    // RevenueCat entitlement identifiers (must match exactly what's in RC dashboard)
    if (customerInfo.entitlements.active['Paywatch_premium']) return 'premium';
    if (customerInfo.entitlements.active['Paywatch_Pro']) return 'pro';
    return null;
  } catch {
    return null;
  }
}

/** Show RevenueCat paywall (returns true if purchased) */
export async function presentPaywall(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return false;

    const { RevenueCatUI, PAYWALL_RESULT } = await import('@revenuecat/purchases-capacitor-ui');
    const { result } = await RevenueCatUI.presentPaywall();

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      default:
        return false;
    }
  } catch (err) {
    console.error('[RevenueCat] Paywall error:', err);
    return false;
  }
}

/** Show paywall for a specific offering (e.g. "Paywatch_Pro" or "Paywatch_premium") */
export async function presentPaywallIfNeeded(requiredEntitlement: string): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return false;

    const { RevenueCatUI, PAYWALL_RESULT } = await import('@revenuecat/purchases-capacitor-ui');
    const { result } = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: requiredEntitlement,
    });

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      case PAYWALL_RESULT.NOT_PRESENTED:
        // User already has the entitlement — no paywall shown
        return true;
      default:
        return false;
    }
  } catch (err) {
    console.error('[RevenueCat] Paywall error:', err);
    return false;
  }
}

/** RevenueCat entitlement identifiers — must match exactly what's in RC dashboard */
export const RC_ENTITLEMENTS = {
  pro: 'Paywatch_Pro',
  premium: 'Paywatch_premium',
} as const;
