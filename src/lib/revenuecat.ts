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

    const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY;
    if (!apiKey) {
      console.error('[RevenueCat] NEXT_PUBLIC_REVENUECAT_IOS_API_KEY not set');
      return;
    }

    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

    await Purchases.configure({
      apiKey,
      appUserID: userId,
    });

    initialized = true;
    console.log('[RevenueCat] Initialized for user:', userId);

    // Verify offerings load correctly
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        console.log('[RevenueCat] Offering ready:', offerings.current.identifier);
      } else {
        console.error('[RevenueCat] No current offering — check RC dashboard default offering');
      }
    } catch (offerErr) {
      console.error('[RevenueCat] Failed to fetch offerings:', offerErr);
    }
  } catch (err: unknown) {
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

    const { Purchases } = await import('@revenuecat/purchases-capacitor');

    // Pre-check: can we fetch offerings?
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) {
      console.error('[RevenueCat] Cannot present paywall — no current offering');
      console.error('[RevenueCat] Offerings:', JSON.stringify(offerings, null, 2));
      return false;
    }
    console.log('[RevenueCat] Offering ready, presenting paywall...');

    const { RevenueCatUI, PAYWALL_RESULT } = await import('@revenuecat/purchases-capacitor-ui');
    const { result } = await RevenueCatUI.presentPaywall();

    console.log('[RevenueCat] Paywall result:', result);

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      default:
        return false;
    }
  } catch (err: unknown) {
    console.error('[RevenueCat] Paywall error:', err);
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      console.error('[RevenueCat] code:', e.code, 'msg:', e.message);
      console.error('[RevenueCat] underlying:', e.underlyingErrorMessage);
      console.error('[RevenueCat] full:', JSON.stringify(err, null, 2));
    }
    return false;
  }
}

/** Show paywall only if user doesn't have the required entitlement */
export async function presentPaywallIfNeeded(requiredEntitlement: string): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return false;

    const { RevenueCatUI, PAYWALL_RESULT } = await import('@revenuecat/purchases-capacitor-ui');
    const { result } = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: requiredEntitlement,
    });

    console.log('[RevenueCat] PaywallIfNeeded result:', result);

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      case PAYWALL_RESULT.NOT_PRESENTED:
        return true;
      default:
        return false;
    }
  } catch (err: unknown) {
    console.error('[RevenueCat] PaywallIfNeeded error:', err);
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      console.error('[RevenueCat] underlying:', e.underlyingErrorMessage);
    }
    return false;
  }
}

export const RC_ENTITLEMENTS = {
  pro: 'Paywatch_Pro',
  premium: 'Paywatch_premium',
} as const;
