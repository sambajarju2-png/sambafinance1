import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

const PRICE_MAP: Record<string, string | undefined> = {
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  premium_monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
  premium_yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID,
};

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503, headers: NO_CACHE });

  const { plan_id } = await req.json();
  const priceId = PRICE_MAP[plan_id];
  if (!priceId) return NextResponse.json({ error: 'Ongeldig plan' }, { status: 400, headers: NO_CACHE });

  const supabase = await createServerSupabaseClient();
  const serviceClient = createServiceRoleClient();

  // Get user email
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email;

  // Check if user has ever had a paid subscription (to determine trial eligibility)
  const { data: existingSub } = await serviceClient
    .from('paywatch_subscriptions')
    .select('id, sub_status')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  const isTrialEligible = !existingSub; // Never had any subscription → eligible for trial

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as const });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    // iDEAL for subscriptions requires SEPA Debit — now activated in Stripe Dashboard
    payment_method_types: ['card', 'ideal'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    metadata: { user_id: userId, plan_id },
    // 14-day free trial for first-time subscribers
    subscription_data: isTrialEligible
      ? { trial_period_days: 14, metadata: { user_id: userId, plan_id } }
      : { metadata: { user_id: userId, plan_id } },
    success_url: `${appUrl}/instellingen?tab=abonnement&success=1`,
    cancel_url: `${appUrl}/instellingen?tab=abonnement`,
    locale: 'nl',
    ...(isTrialEligible && {
      custom_text: {
        submit: {
          message: 'Je begint met een gratis proefperiode van 14 dagen. Je wordt niet eerder dan na 14 dagen in rekening gebracht.',
        },
      },
    }),
  });

  return NextResponse.json({
    url: session.url,
    trial_eligible: isTrialEligible,
  }, { headers: NO_CACHE });
}
