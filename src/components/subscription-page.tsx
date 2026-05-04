'use client';

import React, { useState, useEffect } from 'react';
import { Check, Zap, Crown, Loader2, ExternalLink, CreditCard, ArrowRight, AlertTriangle, Clock, Calendar, X } from 'lucide-react';

interface PlanRule {
  plan_id: string;
  display_name: string;
  voice_seconds_per_month: number;
  chat_messages_per_day: number;
  ai_insights_enabled: boolean;
  ai_chat_enabled: boolean;
  dispute_letters_enabled: boolean;
  bank_sync_enabled: boolean;
  export_reports_enabled: boolean;
}

interface Subscription {
  plan_id: string;
  sub_status: string;
  period_end: string | null;
  trial_end: string | null;
  cancel_at_end: boolean;
  payment_provider: string;
}

const PRICES = {
  pro_monthly: 4.00,
  pro_yearly: 40.00,
  premium_monthly: 8.00,
  premium_yearly: 80.00,
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export default function SubscriptionPage({ lang = 'nl' }: { lang?: string }) {
  const [currentPlan, setCurrentPlan] = useState<string>('gratis');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<PlanRule[]>([]);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [trialEligible, setTrialEligible] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) setIsNative(true);
      } catch {}
    })();

    async function load() {
      try {
        const [settingsRes, plansRes, subRes] = await Promise.all([
          fetch('/api/settings/plan'),
          fetch('/api/plans'),
          fetch('/api/stripe/subscription'),
        ]);
        if (settingsRes.ok) {
          const d = await settingsRes.json();
          setCurrentPlan(d.plan || 'gratis');
        }
        if (plansRes.ok) {
          const d = await plansRes.json();
          setPlans(d.plans || []);
        }
        if (subRes.ok) {
          const d = await subRes.json();
          setSubscription(d.subscription || null);
          setTrialEligible(!d.subscription);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function openPortal() {
    if (isNative) {
      if (typeof window !== 'undefined') window.location.href = 'itms-apps://apps.apple.com/account/subscriptions';
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/stripe/create-portal-session', { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        if (typeof window !== 'undefined') window.location.href = d.url;
      }
    } catch {}
    setActionLoading(false);
  }

  async function subscribe(planId: string) {
    if (isNative) {
      // iOS: use RevenueCat paywall
      setActionLoading(true);
      const { presentPaywall } = await import('@/lib/revenuecat');
      const purchased = await presentPaywall();
      if (purchased) {
        // Reload subscription status after purchase
        const subRes = await fetch('/api/stripe/subscription');
        if (subRes.ok) {
          const d = await subRes.json();
          setSubscription(d.subscription || null);
        }
        const planRes = await fetch('/api/settings/plan');
        if (planRes.ok) {
          const d = await planRes.json();
          setCurrentPlan(d.plan || 'gratis');
        }
      }
      setActionLoading(false);
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      });
      if (res.ok) {
        const d = await res.json();
        if (typeof window !== 'undefined') window.location.href = d.url;
      }
    } catch {}
    setActionLoading(false);
  }

  async function cancelSubscription() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/stripe/cancel-subscription', { method: 'POST' });
      if (res.ok) {
        setCancelConfirm(false);
        setCancelDone(true);
        setSubscription(prev => prev ? { ...prev, cancel_at_end: true } : prev);
      }
    } catch {}
    setActionLoading(false);
  }

  const isPro = currentPlan.startsWith('pro');
  const isPremium = currentPlan.startsWith('premium');
  const isPaid = isPro || isPremium;
  const isTrialing = subscription?.sub_status === 'trialing';

  const proId = billing === 'monthly' ? 'pro_monthly' : 'pro_yearly';
  const premiumId = billing === 'monthly' ? 'premium_monthly' : 'premium_yearly';

  const trialDaysLeft = isTrialing ? daysUntil(subscription?.trial_end ?? null) : null;
  const trialEndDate = formatDate(subscription?.trial_end ?? null);
  // During trial, period_end may be null — fall back to trial_end
  const effectivePeriodEnd = subscription?.period_end ?? subscription?.trial_end ?? null;
  const nextPaymentDate = formatDate(effectivePeriodEnd);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-pw-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h2 className="text-[18px] font-bold text-pw-navy dark:text-white">Abonnement</h2>
        <p className="text-[12px] text-pw-muted mt-0.5">Jouw PayWatch plan</p>
      </div>

      {/* ── Current subscription status card ── */}
      {isPaid && subscription && (
        <div className={`rounded-2xl border p-4 space-y-3 ${
          isTrialing 
            ? 'border-pw-blue/30 bg-pw-blue/5 dark:bg-pw-blue/10' 
            : subscription.cancel_at_end
            ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-500/5'
            : 'border-pw-border bg-pw-surface dark:bg-white/5'
        }`}>
          {/* Plan badge + status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                isPremium ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-pw-blue/10'
              }`}>
                {isPremium 
                  ? <Crown className="h-4 w-4 text-amber-500" />
                  : <Zap className="h-4 w-4 text-pw-blue" />
                }
              </div>
              <div>
                <p className="text-[14px] font-bold text-pw-navy dark:text-white">
                  {isPremium ? 'Premium' : 'Pro'}
                </p>
                {isTrialing && (
                  <span className="text-[10px] font-semibold text-pw-blue">Gratis proefperiode</span>
                )}
              </div>
            </div>
            {subscription.cancel_at_end ? (
              <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                Wordt opgezegd
              </span>
            ) : isTrialing ? (
              <span className="rounded-full bg-pw-blue/10 px-2.5 py-1 text-[11px] font-semibold text-pw-blue">
                Trial
              </span>
            ) : (
              <span className="rounded-full bg-pw-green/10 px-2.5 py-1 text-[11px] font-semibold text-pw-green">
                Actief
              </span>
            )}
          </div>

          {/* Trial warning */}
          {isTrialing && trialDaysLeft !== null && (
            <div className="flex items-start gap-2.5 rounded-xl bg-pw-blue/10 dark:bg-pw-blue/20 px-3 py-2.5">
              <Clock className="h-4 w-4 flex-shrink-0 mt-0.5 text-pw-blue" />
              <div>
                <p className="text-[12px] font-semibold text-pw-navy dark:text-white">
                  {trialDaysLeft === 0
                    ? 'Proefperiode loopt vandaag af'
                    : `Nog ${trialDaysLeft} ${trialDaysLeft === 1 ? 'dag' : 'dagen'} gratis`}
                </p>
                {trialEndDate && (
                  <p className="text-[11px] text-pw-muted mt-0.5">
                    Eerste betaling op {trialEndDate}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cancellation warning */}
          {subscription.cancel_at_end && !cancelDone && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
              <p className="text-[12px] text-amber-700 dark:text-amber-400">
                Je abonnement loopt af op {nextPaymentDate}. Je houdt toegang tot die datum.
              </p>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            {isTrialing && trialEndDate && (
              <div className="rounded-xl bg-pw-bg dark:bg-white/5 px-3 py-2">
                <p className="text-[10px] text-pw-muted mb-0.5">Proef eindigt</p>
                <p className="text-[12px] font-semibold text-pw-navy dark:text-white">{trialEndDate}</p>
              </div>
            )}
            {nextPaymentDate && !subscription.cancel_at_end && (
              <div className="rounded-xl bg-pw-bg dark:bg-white/5 px-3 py-2">
                <p className="text-[10px] text-pw-muted mb-0.5">
                  {isTrialing ? 'Eerste betaling' : 'Volgende betaling'}
                </p>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-pw-muted" />
                  <p className="text-[12px] font-semibold text-pw-navy dark:text-white">{nextPaymentDate}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={openPortal}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-pw-bg dark:bg-white/10 border border-pw-border px-3 py-2 text-[12px] font-semibold text-pw-text dark:text-white"
            >
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              Betaalmethode
            </button>

            {!subscription.cancel_at_end && !cancelConfirm && (
              <button
                onClick={() => setCancelConfirm(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 dark:border-red-500/30 px-3 py-2 text-[12px] font-semibold text-pw-red"
              >
                <X className="h-3.5 w-3.5" />
                Opzeggen
              </button>
            )}
          </div>

          {/* Cancel confirm */}
          {cancelConfirm && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-3 space-y-2">
              <p className="text-[12px] text-pw-text dark:text-white leading-relaxed">
                Weet je het zeker? Je behoudt toegang t/m {nextPaymentDate}.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={cancelSubscription}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-pw-red px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Ja, opzeggen
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="flex-1 rounded-xl border border-pw-border bg-pw-surface dark:bg-white/5 px-3 py-2 text-[12px] font-semibold text-pw-muted"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gratis plan status */}
      {!isPaid && (
        <div className="rounded-2xl border border-pw-border bg-pw-surface dark:bg-white/5 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pw-bg dark:bg-white/10">
              <span className="text-[13px]">✓</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-pw-navy dark:text-white">Gratis plan actief</p>
              <p className="text-[11px] text-pw-muted">Upgrade voor meer functies</p>
            </div>
          </div>
        </div>
      )}

      {/* Billing toggle — only show for upgrade when on free */}
      {!isPaid && (
        <>
          <div className="flex items-center justify-center gap-1 rounded-2xl bg-pw-bg dark:bg-white/5 p-1">
            {(['monthly', 'yearly'] as const).map(b => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={`flex-1 rounded-xl py-2 text-[13px] font-semibold transition-all ${
                  billing === b
                    ? 'bg-white dark:bg-white/20 text-pw-text dark:text-white shadow-sm'
                    : 'text-pw-muted'
                }`}
              >
                {b === 'monthly' ? 'Maandelijks' : 'Jaarlijks'}
                {b === 'yearly' && (
                  <span className="ml-1.5 rounded-full bg-pw-green/15 px-1.5 py-0.5 text-[10px] font-bold text-pw-green">-17%</span>
                )}
              </button>
            ))}
          </div>

          {/* Plan cards */}
          <div className="space-y-3">
            <PlanCard
              name="Pro"
              icon={<Zap className="h-4 w-4" />}
              price={billing === 'monthly' ? PRICES.pro_monthly : PRICES.pro_yearly}
              billing={billing}
              isHighlight
              trialEligible={trialEligible}
              features={['15 min PayBuddy/maand','Onbeperkte AI chat','AI inzichten (dagelijks)','10 bezwaarschriften/maand','Rapporten exporteren']}
              onUpgrade={() => subscribe(proId)}
              ctaLabel={trialEligible ? '14 dagen gratis proberen' : 'Upgraden naar Pro'}
              loading={actionLoading}
            />
            <PlanCard
              name="Premium"
              icon={<Crown className="h-4 w-4" />}
              price={billing === 'monthly' ? PRICES.premium_monthly : PRICES.premium_yearly}
              billing={billing}
              isPremium
              trialEligible={trialEligible}
              features={['30 min PayBuddy/maand','Alles van Pro','Onbeperkte bezwaarschriften','Bankrekening synchroniseren']}
              onUpgrade={() => subscribe(premiumId)}
              ctaLabel={trialEligible ? '14 dagen gratis proberen' : 'Upgraden naar Premium'}
              loading={actionLoading}
            />
          </div>
        </>
      )}

      {/* Manage link for paid users */}
      {isPaid && (
        <div className="text-center">
          <button
            onClick={openPortal}
            disabled={actionLoading}
            className="text-[12px] text-pw-muted hover:text-pw-blue transition-colors inline-flex items-center gap-1"
          >
            <CreditCard className="h-3 w-3" />
            Facturen & betaalmethode beheren
          </button>
        </div>
      )}

      <p className="text-center text-[11px] text-pw-muted px-4">
        {trialEligible && !isPaid
          ? 'Eerste 14 dagen gratis. Daarna automatisch verlengd. Opzeggen kan altijd.'
          : `Betaling via ${isNative ? 'de App Store' : 'Stripe'}. Opzeggen kan altijd vóór verlengingsdatum.`
        }
      </p>
    </div>
  );
}

function PlanCard({ name, icon, price, billing, isHighlight, isPremium, trialEligible, features, onUpgrade, ctaLabel, loading }: {
  name: string; icon: React.ReactNode; price: number; billing: 'monthly' | 'yearly';
  isHighlight?: boolean; isPremium?: boolean; trialEligible?: boolean;
  features: string[]; onUpgrade: () => void; ctaLabel: string; loading?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${
      isPremium ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5'
      : isHighlight ? 'border-pw-blue/30 bg-pw-blue/5 dark:bg-pw-blue/10'
      : 'border-pw-border bg-pw-surface dark:bg-white/5'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isPremium ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-500' : 'bg-pw-blue/10 text-pw-blue'}`}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-bold text-pw-navy dark:text-white">{name}</p>
              {trialEligible && (
                <span className="rounded-full bg-pw-green/15 px-2 py-0.5 text-[10px] font-bold text-pw-green">14 dagen gratis</span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-extrabold text-pw-navy dark:text-white">€{price.toFixed(2).replace('.', ',')}</p>
          <p className="text-[10px] text-pw-muted">{billing === 'yearly' ? '/jaar' : '/maand'}</p>
        </div>
      </div>
      <ul className="space-y-1.5 mb-4">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] text-pw-text dark:text-white/80">
            <Check className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-pw-green" strokeWidth={2.5} />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onUpgrade}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold ${
          isPremium ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm'
          : 'bg-pw-blue text-white shadow-sm'
        } disabled:opacity-50`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{ctaLabel}<ArrowRight className="h-3.5 w-3.5" /></>}
      </button>
    </div>
  );
}
