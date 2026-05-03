/**
 * PayWatch plan definitions
 * Limits are in seconds. Set ENFORCE_VOICE_LIMITS=false to disable enforcement
 * (use during free-access period before monetisation goes live).
 */

export type PlanId = 'gratis' | 'pro' | 'premium';

export interface Plan {
  id: PlanId;
  name: string;
  nameNl: string;
  voiceSecondsPerMonth: number;   // seconds of PayBuddy call time per month
  chatMessagesPerDay: number;     // AI chat messages per day (-1 = unlimited)
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  gratis: {
    id: 'gratis',
    name: 'PayWatch Gratis',
    nameNl: 'Gratis',
    voiceSecondsPerMonth: 600,    // 10 min/month
    chatMessagesPerDay: 20,
    features: [
      'Rekeningen bijhouden',
      'Gmail & camera scan',
      'PayBuddy (10 min/maand)',
      'WIK check',
      'Basisoverzicht',
    ],
  },
  pro: {
    id: 'pro',
    name: 'PayWatch Pro',
    nameNl: 'Pro',
    voiceSecondsPerMonth: 3600,   // 60 min/month
    chatMessagesPerDay: -1,       // unlimited
    features: [
      'Alles van Gratis',
      'PayBuddy (60 min/maand)',
      'Onbeperkt chatten',
      'Bezwaarbrieven AI',
      'Schuldhulp routing',
      'Prioriteit support',
    ],
  },
  premium: {
    id: 'premium',
    name: 'PayWatch Premium',
    nameNl: 'Premium',
    voiceSecondsPerMonth: 99999,  // effectively unlimited
    chatMessagesPerDay: -1,
    features: [
      'Alles van Pro',
      'Onbeperkt PayBuddy',
      'Vroege toegang nieuwe features',
      'Persoonlijke onboarding',
      'Dedicated support',
    ],
  },
};

export function getPlan(planId: PlanId | string): Plan {
  return PLANS[planId as PlanId] ?? PLANS.gratis;
}

/** Returns true if user has exceeded their voice limit this month */
export function isVoiceLimitExceeded(
  plan: PlanId | string,
  secondsUsed: number,
  enforce = true,
): boolean {
  if (!enforce) return false;
  const p = getPlan(plan);
  return secondsUsed >= p.voiceSecondsPerMonth;
}

/** Remaining voice seconds for a user */
export function voiceSecondsRemaining(plan: PlanId | string, secondsUsed: number): number {
  const p = getPlan(plan);
  return Math.max(0, p.voiceSecondsPerMonth - secondsUsed);
}

/** Format seconds as "X min Y sec" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}
