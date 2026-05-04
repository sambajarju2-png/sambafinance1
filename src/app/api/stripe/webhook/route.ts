import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function planFromPrice(priceId: string | null | undefined): string {
  if (!priceId) return 'gratis';
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) return 'pro_monthly';
  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return 'pro_yearly';
  if (priceId === process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID) return 'premium_monthly';
  if (priceId === process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID) return 'premium_yearly';
  return 'gratis';
}

/** Try to resolve user_id from subscription metadata, falling back to customer lookup */
async function resolveUserId(supabase: any, sub: any): Promise<string | null> {
  // 1. Direct from metadata
  if (sub.metadata?.user_id) return sub.metadata.user_id;

  // 2. From subscription_data.metadata (set in checkout session)
  // Already covered above for most cases

  // 3. Look up existing row by stripe_customer_id
  if (sub.customer) {
    const { data } = await supabase
      .from('paywatch_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', sub.customer)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  // 4. Look up by stripe_subscription_id (if row already exists from checkout.session.completed)
  if (sub.id) {
    const { data } = await supabase
      .from('paywatch_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', sub.id)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  return null;
}

async function handleSubscriptionUpsert(supabase: any, sub: any, eventType: string) {
  const userId = await resolveUserId(supabase, sub);
  if (!userId) {
    console.warn(`[Stripe webhook] ${eventType}: no user_id found for sub=${sub.id}, customer=${sub.customer}`);
    return;
  }

  const priceId = sub.items?.data?.[0]?.price?.id;
  const planId = planFromPrice(priceId);

  const row: Record<string, any> = {
    user_id: userId,
    plan_id: planId,
    payment_provider: 'stripe',
    sub_status: sub.status,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    period_start: new Date(sub.current_period_start * 1000).toISOString(),
    period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_end: sub.cancel_at_period_end,
    amount_cents: sub.items?.data?.[0]?.price?.unit_amount || 0,
    currency: sub.currency || 'eur',
    updated_at: new Date().toISOString(),
  };

  // Store trial_end if in trial
  if (sub.trial_end) {
    row.trial_end = new Date(sub.trial_end * 1000).toISOString();
  }

  // Upsert on stripe_subscription_id (now has UNIQUE index)
  const { error } = await supabase
    .from('paywatch_subscriptions')
    .upsert(row, { onConflict: 'stripe_subscription_id' });

  if (error) {
    console.error(`[Stripe webhook] upsert error:`, error);
    throw error;
  }

  // Update user plan — active during trialing and active
  const activePlan = ['active', 'trialing'].includes(sub.status) ? planId : 'gratis';
  await supabase
    .from('user_settings')
    .update({ plan: activePlan })
    .eq('user_id', userId);

  console.log(`[Stripe webhook] ${eventType}: user=${userId} plan=${activePlan} status=${sub.status} sub=${sub.id}`);
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    console.error('[Stripe webhook] Missing env vars');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature') || '';

  let event: any;
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as const });
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.resumed':
      case 'customer.subscription.pending_update_applied': {
        await handleSubscriptionUpsert(supabase, event.data.object, event.type);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = await resolveUserId(supabase, sub);

        await supabase
          .from('paywatch_subscriptions')
          .update({ sub_status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);

        if (userId) {
          await supabase.from('user_settings').update({ plan: 'gratis' }).eq('user_id', userId);
          console.log(`[Stripe webhook] subscription deleted: user=${userId} → gratis`);
        }
        break;
      }

      case 'customer.subscription.paused': {
        const sub = event.data.object;
        const userId = await resolveUserId(supabase, sub);
        await supabase
          .from('paywatch_subscriptions')
          .update({ sub_status: 'paused', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
        if (userId) {
          await supabase.from('user_settings').update({ plan: 'gratis' }).eq('user_id', userId);
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object;
        const userId = await resolveUserId(supabase, sub);
        console.log(`[Stripe webhook] trial_will_end: user=${userId} sub=${sub.id}`);
        // TODO: send Resend trial-ending email
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;
        await supabase
          .from('paywatch_subscriptions')
          .update({ sub_status: 'active', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subId);
        console.log(`[Stripe webhook] invoice paid: sub=${subId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;
        await supabase
          .from('paywatch_subscriptions')
          .update({ sub_status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subId);
        console.log(`[Stripe webhook] invoice payment failed: sub=${subId}`);
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        if (!userId || !planId || session.mode !== 'subscription') break;

        // Pre-seed the row with user_id + customer so subscription.created can find it
        if (session.customer && session.subscription) {
          await supabase.from('paywatch_subscriptions').upsert({
            user_id: userId,
            plan_id: planId,
            payment_provider: 'stripe',
            sub_status: 'trialing',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'stripe_subscription_id' });
        } else if (session.customer) {
          // Subscription ID not yet available, just store customer mapping
          await supabase.from('paywatch_subscriptions').upsert({
            user_id: userId,
            plan_id: planId,
            payment_provider: 'stripe',
            sub_status: 'trialing',
            stripe_customer_id: session.customer,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,payment_provider' });
        }
        console.log(`[Stripe webhook] checkout completed: user=${userId} plan=${planId}`);
        break;
      }
    }
  } catch (err) {
    console.error('[Stripe webhook] Handler error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
