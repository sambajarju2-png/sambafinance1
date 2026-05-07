'use client';

import React, { useState, useEffect } from 'react';
import { Check, Zap, Crown, Loader2, ExternalLink, CreditCard, ArrowRight, AlertTriangle, Clock, Calendar, X, Gift, Smartphone, Globe } from 'lucide-react';

interface Subscription {
  plan_id: string;
  sub_status: string;
  period_end: string | null;
  trial_end: string | null;
  cancel_at_end: boolean;
  payment_provider: string;
}

// App Store prices (iOS only — set by Apple price tier)
const APP_STORE_PRICES = { pro_monthly: 4.99, pro_yearly: 44.99, premium_monthly: 8.99, premium_yearly: 79.99 };
// Stripe prices (web only)
const STRIPE_PRICES = { pro_monthly: 4.00, pro_yearly: 40.00, premium_monthly: 8.00, premium_yearly: 80.00 };
// Keep PRICES as fallback (unused directly — resolved per-platform below)
const PRICES = APP_STORE_PRICES;

// ── Actual limits from plan_rules table ──────────────────────────────────────
const PLANS = [
  {
    id: 'gratis',
    name: 'Gratis',
    icon: null,
    priceMonthly: 0,
    priceYearly: 0,
    color: 'text-pw-muted',
    bg: 'bg-pw-bg',
    border: 'border-pw-border',
    featuresMonthly: [
      '5 min PayBuddy/maand',
      '15 AI chats per dag',
      '2 bezwaarschriften/maand',
      '2 AI inzichten/maand',
      '10 scans per maand',
      '1 e-mail inbox',
    ],
    featuresYearly: [
      '5 min PayBuddy/maand',
      '15 AI chats per dag',
      '2 bezwaarschriften/maand',
      '2 AI inzichten/maand',
      '10 scans per maand',
      '1 e-mail inbox',
    ],
    notIncluded: ['Bankrekening koppelen'],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Zap,
    priceMonthly: 4.99,   // App Store; Stripe: 4.00
    priceYearly: 44.99,   // App Store; Stripe: 40.00
    color: 'text-pw-blue',
    bg: 'bg-pw-blue/5',
    border: 'border-pw-blue/30',
    highlight: true,
    featuresMonthly: [
      '15 min PayBuddy/maand',
      '30 AI chats per dag',
      '8 bezwaarschriften/maand',
      '6 AI inzichten/maand',
      'Onbeperkt scannen',
      '2 e-mail inboxen',
      '1 bankrekening koppelen',
    ],
    featuresYearly: [
      '25 min PayBuddy/maand',
      '40 AI chats per dag',
      '12 bezwaarschriften/maand',
      '8 AI inzichten/maand',
      'Onbeperkt scannen',
      '2 e-mail inboxen',
      '1 bankrekening koppelen',
    ],
    notIncluded: [],
  },
  {
    id: 'premium',
    name: 'Premium',
    icon: Crown,
    priceMonthly: 8.99,   // App Store; Stripe: 8.00
    priceYearly: 79.99,   // App Store; Stripe: 80.00
    color: 'text-amber-500',
    bg: 'bg-amber-50/50 dark:bg-amber-500/5',
    border: 'border-amber-200 dark:border-amber-500/30',
    featuresMonthly: [
      '40 min PayBuddy/maand',
      'Onbeperkt AI chatten',
      'Onbeperkte bezwaarschriften',
      '12 AI inzichten/maand',
      '4 e-mail inboxen',
      'Onbeperkt bankrekeningen',
    ],
    featuresYearly: [
      '60 min PayBuddy/maand',
      'Onbeperkt AI chatten',
      'Onbeperkte bezwaarschriften',
      '15 AI inzichten/maand',
      '6 e-mail inboxen',
      'Onbeperkt bankrekeningen',
    ],
    notIncluded: [],
  },
];

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}
function daysUntil(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export default function SubscriptionPage({ lang = 'nl' }: { lang?: string }) {
  const [currentPlan, setCurrentPlan] = useState<string>('gratis');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
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
        const [settingsRes, subRes] = await Promise.all([
          fetch('/api/settings/plan'),
          fetch('/api/stripe/subscription'),
        ]);
        if (settingsRes.ok) {
          const d = await settingsRes.json();
          setCurrentPlan(d.plan || 'gratis');
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
      if (res.ok) { const d = await res.json(); if (typeof window !== 'undefined') window.location.href = d.url; }
    } catch {}
    setActionLoading(false);
  }

  async function subscribe(planId: string) {
    if (isNative) {
      setActionLoading(true);
      const { presentPaywall } = await import('@/lib/revenuecat');
      const purchased = await presentPaywall();
      if (purchased) {
        const [sRes, pRes] = await Promise.all([fetch('/api/stripe/subscription'), fetch('/api/settings/plan')]);
        if (sRes.ok) { const d = await sRes.json(); setSubscription(d.subscription || null); }
        if (pRes.ok) { const d = await pRes.json(); setCurrentPlan(d.plan || 'gratis'); }
      }
      setActionLoading(false);
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      });
      if (res.ok) { const d = await res.json(); if (typeof window !== 'undefined') window.location.href = d.url; }
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
  const trialDaysLeft = isTrialing ? daysUntil(subscription?.trial_end ?? null) : null;
  const trialEndDate = formatDate(subscription?.trial_end ?? null);
  const nextPaymentDate = formatDate(subscription?.period_end ?? null);

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
        <p className="text-[12px] text-pw-muted mt-0.5">Kies het plan dat bij je past</p>
      </div>

      {/* ── Active subscription status ── */}
      {isPaid && subscription && (
        <div className={`rounded-2xl border p-4 space-y-3 ${
          isTrialing ? 'border-pw-blue/30 bg-pw-blue/5 dark:bg-pw-blue/10'
          : subscription.cancel_at_end ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-500/5'
          : 'border-pw-border bg-pw-surface dark:bg-white/5'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${isPremium ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-pw-blue/10'}`}>
                {isPremium ? <Crown className="h-4 w-4 text-amber-500" /> : <Zap className="h-4 w-4 text-pw-blue" />}
              </div>
              <div>
                <p className="text-[14px] font-bold text-pw-navy dark:text-white">{isPremium ? 'Premium' : 'Pro'}</p>
                {isTrialing && <span className="text-[10px] font-semibold text-pw-blue">Gratis proefperiode</span>}
              </div>
            </div>
            {subscription.cancel_at_end
              ? <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">Wordt opgezegd</span>
              : isTrialing
              ? <span className="rounded-full bg-pw-blue/10 px-2.5 py-1 text-[11px] font-semibold text-pw-blue">Trial</span>
              : <span className="rounded-full bg-pw-green/10 px-2.5 py-1 text-[11px] font-semibold text-pw-green">Actief</span>
            }
          </div>

          {isTrialing && trialDaysLeft !== null && (
            <div className="flex items-start gap-2.5 rounded-xl bg-pw-blue/10 dark:bg-pw-blue/20 px-3 py-2.5">
              <Clock className="h-4 w-4 flex-shrink-0 mt-0.5 text-pw-blue" />
              <div>
                <p className="text-[12px] font-semibold text-pw-navy dark:text-white">
                  {trialDaysLeft === 0 ? 'Proefperiode loopt vandaag af' : `Nog ${trialDaysLeft} ${trialDaysLeft === 1 ? 'dag' : 'dagen'} gratis`}
                </p>
                {trialEndDate && <p className="text-[11px] text-pw-muted mt-0.5">Eerste betaling op {trialEndDate}</p>}
              </div>
            </div>
          )}

          {subscription.cancel_at_end && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
              <p className="text-[12px] text-amber-700 dark:text-amber-400">Loopt af op {nextPaymentDate}. Je houdt toegang tot die datum.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {isTrialing && trialEndDate && (
              <div className="rounded-xl bg-pw-bg dark:bg-white/5 px-3 py-2">
                <p className="text-[10px] text-pw-muted mb-0.5">Proef eindigt</p>
                <p className="text-[12px] font-semibold text-pw-navy dark:text-white">{trialEndDate}</p>
              </div>
            )}
            {nextPaymentDate && !subscription.cancel_at_end && (
              <div className="rounded-xl bg-pw-bg dark:bg-white/5 px-3 py-2">
                <p className="text-[10px] text-pw-muted mb-0.5">{isTrialing ? 'Eerste betaling' : 'Volgende betaling'}</p>
                <p className="text-[12px] font-semibold text-pw-navy dark:text-white">{nextPaymentDate}</p>
              </div>
            )}
          </div>

          {/* Provider badge */}
          <div className="flex items-center gap-1.5">
            {subscription.payment_provider === 'revenuecat'
              ? <><Smartphone className="h-3 w-3 text-pw-muted" /><span className="text-[10px] text-pw-muted">Beheerd via App Store</span></>
              : <><Globe className="h-3 w-3 text-pw-muted" /><span className="text-[10px] text-pw-muted">Beheerd via Stripe</span></>
            }
          </div>

          <div className="flex gap-2">
            <button onClick={openPortal} disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-pw-bg dark:bg-white/10 border border-pw-border px-3 py-2 text-[12px] font-semibold text-pw-text dark:text-white">
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              Betaalmethode
            </button>
            {!subscription.cancel_at_end && !cancelConfirm && (
              <button onClick={() => setCancelConfirm(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 dark:border-red-500/30 px-3 py-2 text-[12px] font-semibold text-pw-red">
                <X className="h-3.5 w-3.5" /> Opzeggen
              </button>
            )}
          </div>

          {cancelConfirm && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-3 space-y-2">
              <p className="text-[12px] text-pw-text dark:text-white leading-relaxed">Weet je het zeker? Je behoudt toegang t/m {nextPaymentDate}.</p>
              <div className="flex gap-2">
                <button onClick={cancelSubscription} disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-pw-red px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Ja, opzeggen
                </button>
                <button onClick={() => setCancelConfirm(false)} className="flex-1 rounded-xl border border-pw-border bg-pw-surface dark:bg-white/5 px-3 py-2 text-[12px] font-semibold text-pw-muted">
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Billing toggle — always visible ── */}
      <div className="flex items-center justify-center gap-1 rounded-2xl bg-pw-bg dark:bg-white/5 p-1">
        {(['monthly', 'yearly'] as const).map(b => (
          <button key={b} onClick={() => setBilling(b)}
            className={`flex-1 rounded-xl py-2 text-[13px] font-semibold transition-all ${billing === b ? 'bg-white dark:bg-white/20 text-pw-text dark:text-white shadow-sm' : 'text-pw-muted'}`}>
            {b === 'monthly' ? 'Maandelijks' : 'Jaarlijks'}
            {b === 'yearly' && <span className="ml-1.5 rounded-full bg-pw-green/15 px-1.5 py-0.5 text-[10px] font-bold text-pw-green">Bespaar 25%</span>}
          </button>
        ))}
      </div>

      {/* ── Plan cards ── */}
      <div className="space-y-3">
        {PLANS.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id || (plan.id === 'pro' && isPro) || (plan.id === 'premium' && isPremium);
          // Show App Store prices on iOS, Stripe prices on web
          const prices = isNative ? APP_STORE_PRICES : STRIPE_PRICES;
          const priceKey = `${plan.id}_${billing}` as keyof typeof prices;
          const price = plan.id === 'gratis' ? 0 : (prices[priceKey] ?? 0);
          const planId = plan.id === 'pro' ? (billing === 'monthly' ? 'pro_monthly' : 'pro_yearly') : (billing === 'monthly' ? 'premium_monthly' : 'premium_yearly');

          return (
            <div key={plan.id} className={`rounded-2xl border p-4 ${plan.bg} ${isCurrentPlan ? plan.border + ' ring-1 ring-inset ' + plan.border.replace('border-', 'ring-') : 'border-pw-border'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {plan.icon ? (
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${plan.id === 'premium' ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-pw-blue/10'}`}>
                      <plan.icon className={`h-4 w-4 ${plan.color}`} />
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pw-bg dark:bg-white/10">
                      <Gift className="h-4 w-4 text-pw-muted" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-bold text-pw-navy dark:text-white">{plan.name}</p>
                    {isCurrentPlan && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${plan.id === 'gratis' ? 'bg-pw-muted/15 text-pw-muted' : plan.id === 'premium' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' : 'bg-pw-blue/10 text-pw-blue'}`}>Huidig</span>}
                    {!isPaid && plan.id !== 'gratis' && trialEligible && <span className="rounded-full bg-pw-green/15 px-2 py-0.5 text-[10px] font-bold text-pw-green">14 dagen gratis</span>}
                  </div>
                </div>
                <div className="text-right">
                  {plan.id === 'gratis' ? (
                    <p className="text-[18px] font-extrabold text-pw-navy dark:text-white">€0</p>
                  ) : (
                    <>
                      <p className="text-[18px] font-extrabold text-pw-navy dark:text-white">€{price.toFixed(2).replace('.', ',')}</p>
                      <p className="text-[10px] text-pw-muted">{billing === 'yearly' ? '/jaar' : '/maand'}</p>
                      {billing === 'yearly' && (
                        <p className="text-[10px] text-pw-green font-semibold mt-0.5">
                          €{(price / 12).toFixed(2).replace('.', ',')}/maand
                        </p>
                      )}
                      <p className="text-[9px] text-pw-muted/60 mt-0.5 flex items-center justify-end gap-1">
                        {isNative ? <><Smartphone className="h-2.5 w-2.5" /> App Store</> : <><Globe className="h-2.5 w-2.5" /> Stripe</>}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <ul className="space-y-1.5 mb-4">
                {(billing === 'yearly' ? plan.featuresYearly : plan.featuresMonthly).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-pw-text dark:text-white/80">
                    <Check className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-pw-green" strokeWidth={2.5} /> {f}
                  </li>
                ))}
                {plan.notIncluded.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-pw-muted line-through">
                    <X className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" strokeWidth={2} /> {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {!isCurrentPlan && plan.id !== 'gratis' && !isPaid && (
                <button onClick={() => subscribe(planId)} disabled={actionLoading}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold disabled:opacity-50 ${
                    plan.id === 'premium' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm' : 'bg-pw-blue text-white shadow-sm'
                  }`}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>{trialEligible ? '14 dagen gratis proberen' : `Upgraden naar ${plan.name}`}<ArrowRight className="h-3.5 w-3.5" /></>
                  )}
                </button>
              )}

              {isCurrentPlan && plan.id === 'gratis' && (
                <div className="rounded-xl bg-pw-muted/10 px-3 py-2 text-center text-[12px] text-pw-muted">
                  Huidig plan
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Payment management for paid users ── */}
      {isPaid && (
        <div className="text-center">
          <button onClick={openPortal} disabled={actionLoading}
            className="text-[12px] text-pw-muted hover:text-pw-blue transition-colors inline-flex items-center gap-1">
            <CreditCard className="h-3 w-3" /> Facturen & betaalmethode beheren
          </button>
        </div>
      )}

      {/* ── Platform note ── */}
      <div className="rounded-xl bg-pw-bg dark:bg-white/5 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          {isNative
            ? <><Smartphone className="h-3.5 w-3.5 text-pw-muted" /><p className="text-[11px] text-pw-muted font-medium">iOS abonnementen</p></>
            : <><Globe className="h-3.5 w-3.5 text-pw-muted" /><p className="text-[11px] text-pw-muted font-medium">Web abonnementen</p></>
          }
        </div>
        <p className="text-[11px] text-pw-muted leading-relaxed">
          {isNative
            ? 'Betaling via de App Store. Beheer je abonnement via Instellingen → App Store op je iPhone.'
            : trialEligible && !isPaid
            ? 'Eerste 14 dagen gratis. Daarna automatisch verlengd. Opzeggen kan altijd.'
            : 'Betaling via Stripe. Opzeggen kan altijd vóór de verlengingsdatum.'
          }
        </p>
      </div>
    </div>
  );
}
