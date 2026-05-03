/**
 * PayWatch plan definitions
 * ENFORCE_VOICE_LIMITS=true in Vercel env to enable limits.
 * Leave unset (false) during free-access period.
 */

export type PlanId = 'gratis' | 'pro_monthly' | 'pro_yearly' | 'premium_monthly' | 'premium_yearly';

/** Normalised tier (ignores billing period) */
export type PlanTier = 'gratis' | 'pro' | 'premium';

export interface Plan {
  id: PlanId;
  tier: PlanTier;
  name: string;
  nameNl: string;
  billingPeriod: 'free' | 'monthly' | 'yearly';
  voiceSecondsPerMonth: number;
  chatMessagesPerDay: number;           // -1 = unlimited
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  gratis: {
    id: 'gratis', tier: 'gratis',
    name: 'PayWatch Gratis', nameNl: 'Gratis', billingPeriod: 'free',
    voiceSecondsPerMonth: 600,          // 10 min/month
    chatMessagesPerDay: 20,
    features: ['Rekeningen bijhouden','Gmail & camera scan','PayBuddy (10 min/maand)','WIK check','Basisoverzicht'],
  },
  pro_monthly: {
    id: 'pro_monthly', tier: 'pro',
    name: 'PayWatch Pro', nameNl: 'Pro (maandelijks)', billingPeriod: 'monthly',
    voiceSecondsPerMonth: 3600,         // 60 min/month
    chatMessagesPerDay: -1,
    features: ['Alles van Gratis','PayBuddy (60 min/maand)','Onbeperkt chatten','Bezwaarbrieven AI','Schuldhulp routing','Prioriteit support'],
  },
  pro_yearly: {
    id: 'pro_yearly', tier: 'pro',
    name: 'PayWatch Pro', nameNl: 'Pro (jaarlijks)', billingPeriod: 'yearly',
    voiceSecondsPerMonth: 3600,
    chatMessagesPerDay: -1,
    features: ['Alles van Gratis','PayBuddy (60 min/maand)','Onbeperkt chatten','Bezwaarbrieven AI','Schuldhulp routing','Prioriteit support'],
  },
  premium_monthly: {
    id: 'premium_monthly', tier: 'premium',
    name: 'PayWatch Premium', nameNl: 'Premium (maandelijks)', billingPeriod: 'monthly',
    voiceSecondsPerMonth: 99999,        // effectively unlimited
    chatMessagesPerDay: -1,
    features: ['Alles van Pro','Onbeperkt PayBuddy','Vroege toegang nieuwe features','Persoonlijke onboarding','Dedicated support'],
  },
  premium_yearly: {
    id: 'premium_yearly', tier: 'premium',
    name: 'PayWatch Premium', nameNl: 'Premium (jaarlijks)', billingPeriod: 'yearly',
    voiceSecondsPerMonth: 99999,
    chatMessagesPerDay: -1,
    features: ['Alles van Pro','Onbeperkt PayBuddy','Vroege toegang nieuwe features','Persoonlijke onboarding','Dedicated support'],
  },
};

/** Get plan by ID — falls back to gratis */
export function getPlan(planId: PlanId | string): Plan {
  return PLANS[planId as PlanId] ?? PLANS.gratis;
}

/** Get the tier for a plan ID */
export function getPlanTier(planId: PlanId | string): PlanTier {
  return getPlan(planId).tier;
}

/** Returns true if user has exceeded their voice limit */
export function isVoiceLimitExceeded(plan: PlanId | string, secondsUsed: number, enforce = true): boolean {
  if (!enforce) return false;
  return secondsUsed >= getPlan(plan).voiceSecondsPerMonth;
}

/** Remaining voice seconds this month */
export function voiceSecondsRemaining(plan: PlanId | string, secondsUsed: number): number {
  return Math.max(0, getPlan(plan).voiceSecondsPerMonth - secondsUsed);
}

/** Format seconds as "10 min" or "45 min 30s" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

/** Check if plan has at least Pro tier features */
export function isProOrAbove(plan: PlanId | string): boolean {
  return ['pro', 'premium'].includes(getPlan(plan).tier);
}

/** Check if plan has Premium tier features */
export function isPremium(plan: PlanId | string): boolean {
  return getPlan(plan).tier === 'premium';
}
