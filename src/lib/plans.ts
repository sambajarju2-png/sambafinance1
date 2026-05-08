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
    voiceSecondsPerMonth: 300,          // 5 min/month (matches plan_rules)
    chatMessagesPerDay: 15,             // 15/day (matches plan_rules)
    features: ['Rekeningen bijhouden','Gmail & camera scan','PayBuddy (5 min/maand)','WIK check','Basisoverzicht'],
  },
  pro_monthly: {
    id: 'pro_monthly', tier: 'pro',
    name: 'PayWatch Pro', nameNl: 'Pro (maandelijks)', billingPeriod: 'monthly',
    voiceSecondsPerMonth: 900,          // 15 min/month (matches plan_rules)
    chatMessagesPerDay: 30,             // 30/day (matches plan_rules)
    features: ['Alles van Gratis','PayBuddy (15 min/maand)','30 chats per dag','8 bezwaarbrieven/maand','Schuldhulp routing','1 bankrekening koppelen'],
  },
  pro_yearly: {
    id: 'pro_yearly', tier: 'pro',
    name: 'PayWatch Pro', nameNl: 'Pro (jaarlijks)', billingPeriod: 'yearly',
    voiceSecondsPerMonth: 1500,         // 25 min/month (matches plan_rules)
    chatMessagesPerDay: 40,             // 40/day (matches plan_rules)
    features: ['Alles van Gratis','PayBuddy (25 min/maand)','40 chats per dag','12 bezwaarbrieven/maand','Schuldhulp routing','1 bankrekening koppelen'],
  },
  premium_monthly: {
    id: 'premium_monthly', tier: 'premium',
    name: 'PayWatch Premium', nameNl: 'Premium (maandelijks)', billingPeriod: 'monthly',
    voiceSecondsPerMonth: 2400,         // 40 min/month (matches plan_rules)
    chatMessagesPerDay: -1,             // unlimited
    features: ['Alles van Pro','PayBuddy (40 min/maand)','Onbeperkt chatten','Onbeperkte bezwaarbrieven','4 email inboxen','Onbeperkt bankrekeningen'],
  },
  premium_yearly: {
    id: 'premium_yearly', tier: 'premium',
    name: 'PayWatch Premium', nameNl: 'Premium (jaarlijks)', billingPeriod: 'yearly',
    voiceSecondsPerMonth: 3600,         // 60 min/month (matches plan_rules)
    chatMessagesPerDay: -1,             // unlimited
    features: ['Alles van Pro','PayBuddy (60 min/maand)','Onbeperkt chatten','Onbeperkte bezwaarbrieven','6 email inboxen','Onbeperkt bankrekeningen'],
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
