'use client';

import { useState, useEffect } from 'react';
import { Check, Zap, Crown, Loader2, ExternalLink, CreditCard, ArrowRight } from 'lucide-react';

declare const window: any;

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
  cancel_at_end: boolean;
  payment_provider: string;
}

const PRICES = {
  pro_monthly: 4.99,
  pro_yearly: 49.90,
  premium_monthly: 9.99,
  premium_yearly: 99.90,
};

function voiceLabel(secs: number) {
  if (secs >= 99999) return 'Onbeperkt';
  if (secs >= 3600) return `${Math.round(secs / 60)} min/maand`;
  return `${Math.round(secs / 60)} min/maand`;
}

function chatLabel(n: number) {
  if (n === -1) return 'Onbeperkt';
  return `${n} berichten/dag`;
}

export default function SubscriptionPage({ lang = 'nl' }: { lang?: string }) {
  const [currentPlan, setCurrentPlan] = useState<string>('gratis');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<PlanRule[]>([]);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // Detect Capacitor
    try {
      if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
        setIsNative(true);
      }
    } catch {}

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
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function openPortal() {
    if (isNative) {
      window.location.href = 'itms-apps://apps.apple.com/account/subscriptions';
      return;
    }
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/create-portal-session', { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        window.location.href = d.url;
      }
    } catch {}
    setPortalLoading(false);
  }

  async function subscribe(planId: string) {
    if (isNative) {
      // Native: open App Store subscriptions
      window.location.href = 'itms-apps://apps.apple.com/app/id6739605790';
      return;
    }
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      });
      if (res.ok) {
        const d = await res.json();
        window.location.href = d.url;
      }
    } catch {}
    setPortalLoading(false);
  }

  const isPro = currentPlan.startsWith('pro');
  const isPremium = currentPlan.startsWith('premium');
  const isPaid = isPro || isPremium;

  const proId = billing === 'monthly' ? 'pro_monthly' : 'pro_yearly';
  const premiumId = billing === 'monthly' ? 'premium_monthly' : 'premium_yearly';

  const savings = billing === 'yearly' ? 'Bespaar 2 maanden' : null;

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

      {/* Current plan status */}
      {isPaid && subscription && (
        <div className="rounded-2xl border border-pw-border bg-pw-surface dark:bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-pw-text dark:text-white">
                {isPremium ? 'Premium' : 'Pro'} actief
              </p>
              {subscription.period_end && (
                <p className="text-[11px] text-pw-muted mt-0.5">
                  {subscription.cancel_at_end ? 'Loopt af op' : 'Volgende afschrijving op'}{' '}
                  {new Date(subscription.period_end).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {subscription.cancel_at_end && (
                <p className="text-[11px] text-pw-amber mt-0.5">⚠ Opzegging gepland</p>
              )}
            </div>
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="flex items-center gap-1.5 rounded-xl bg-pw-bg dark:bg-white/10 border border-pw-border px-3 py-2 text-[12px] font-semibold text-pw-text dark:text-white"
            >
              {portalLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Beheer
            </button>
          </div>
        </div>
      )}

      {/* Billing toggle */}
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
            {b === 'yearly' && savings && (
              <span className="ml-1.5 rounded-full bg-pw-green/15 px-1.5 py-0.5 text-[10px] font-bold text-pw-green">
                -17%
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      <div className="space-y-3">
        {/* Gratis */}
        <PlanCard
          name="Gratis"
          icon={null}
          price={0}
          billing={billing}
          isCurrent={currentPlan === 'gratis'}
          isHighlight={false}
          features={[
            '10 min PayBuddy/maand',
            'AI chat (20 berichten/dag)',
            'Rekeningen & facturen bijhouden',
            'Schuldhulp verwijzingen',
          ]}
          onUpgrade={() => {}}
          isDowngrade={isPaid}
          ctaLabel="Huidig plan"
        />

        {/* Pro */}
        <PlanCard
          name="Pro"
          icon={<Zap className="h-4 w-4" />}
          price={billing === 'monthly' ? PRICES.pro_monthly : PRICES.pro_yearly}
          billing={billing}
          isCurrent={isPro}
          isHighlight={true}
          features={[
            '1 uur PayBuddy/maand',
            'Onbeperkte AI chat',
            'AI inzichten & analyses',
            'Bezwaarschriften opstellen',
            'Rapporten exporteren',
          ]}
          onUpgrade={() => subscribe(proId)}
          isDowngrade={isPremium}
          ctaLabel={isPro ? 'Huidig plan' : isPremium ? 'Downgraden' : 'Upgraden naar Pro'}
          loading={portalLoading}
        />

        {/* Premium */}
        <PlanCard
          name="Premium"
          icon={<Crown className="h-4 w-4" />}
          price={billing === 'monthly' ? PRICES.premium_monthly : PRICES.premium_yearly}
          billing={billing}
          isCurrent={isPremium}
          isHighlight={false}
          isPremium={true}
          features={[
            'Onbeperkte PayBuddy',
            'Alles van Pro',
            'Bankrekening synchroniseren',
            'Prioriteit ondersteuning',
          ]}
          onUpgrade={() => subscribe(premiumId)}
          isDowngrade={false}
          ctaLabel={isPremium ? 'Huidig plan' : 'Upgraden naar Premium'}
          loading={portalLoading}
        />
      </div>

      {/* Manage / cancel */}
      {isPaid && (
        <div className="text-center">
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="text-[12px] text-pw-muted hover:text-pw-blue transition-colors inline-flex items-center gap-1"
          >
            <CreditCard className="h-3 w-3" />
            Facturen & betaalmethode beheren
          </button>
        </div>
      )}

      <p className="text-center text-[11px] text-pw-muted px-4">
        Betaling via {isNative ? 'de App Store' : 'Stripe'}. Opzeggen kan altijd vóór de volgende verlengingsdatum.
      </p>
    </div>
  );
}

function PlanCard({
  name, icon, price, billing, isCurrent, isHighlight, isPremium, features,
  onUpgrade, isDowngrade, ctaLabel, loading,
}: {
  name: string;
  icon: React.ReactNode;
  price: number;
  billing: 'monthly' | 'yearly';
  isCurrent: boolean;
  isHighlight: boolean;
  isPremium?: boolean;
  features: string[];
  onUpgrade: () => void;
  isDowngrade: boolean;
  ctaLabel: string;
  loading?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      isCurrent
        ? 'border-pw-blue bg-pw-blue/5 dark:bg-pw-blue/10'
        : isPremium
        ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5'
        : 'border-pw-border bg-pw-surface dark:bg-white/5'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              isPremium ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-500' : 'bg-pw-blue/10 text-pw-blue'
            }`}>
              {icon}
            </div>
          )}
          <div>
            <p className="text-[14px] font-bold text-pw-navy dark:text-white">{name}</p>
            {isCurrent && (
              <span className="text-[10px] font-semibold text-pw-blue">Huidig plan</span>
            )}
          </div>
        </div>
        <div className="text-right">
          {price === 0 ? (
            <p className="text-[18px] font-extrabold text-pw-navy dark:text-white">Gratis</p>
          ) : (
            <>
              <p className="text-[18px] font-extrabold text-pw-navy dark:text-white">
                €{price.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-[10px] text-pw-muted">
                {billing === 'yearly' ? '/jaar' : '/maand'}
              </p>
            </>
          )}
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

      {!isCurrent && (
        <button
          onClick={onUpgrade}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition-all ${
            isDowngrade
              ? 'border border-pw-border text-pw-muted bg-pw-bg dark:bg-white/5'
              : isPremium
              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm'
              : 'bg-pw-blue text-white shadow-sm'
          } disabled:opacity-50`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {ctaLabel}
              {!isDowngrade && <ArrowRight className="h-3.5 w-3.5" />}
            </>
          )}
        </button>
      )}
    </div>
  );
}
