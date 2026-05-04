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

async function handleSubscriptionUpsert(supabase: any, sub: any, eventType: string) {
  const userId = sub.metadata?.user_id;
  if (!userId) return;

  const priceId = sub.items?.data?.[0]?.price?.id;
  const planId = planFromPrice(priceId);

  await supabase.from('paywatch_subscriptions').upsert({
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
  }, { onConflict: 'stripe_subscription_id' });

  // Active plans: active, trialing. Everything else → gratis
  const activePlan = ['active', 'trialing'].includes(sub.status) ? planId : 'gratis';
  await supabase.from('user_settings')
    .update({ plan: activePlan })
    .eq('user_id', userId);

  console.log(`[Stripe webhook] ${eventType}: user=${userId} plan=${activePlan} status=${sub.status}`);
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
      // ── Subscription lifecycle ──────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.resumed':
      case 'customer.subscription.pending_update_applied': {
        await handleSubscriptionUpsert(supabase, event.data.object, event.type);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabase.from('paywatch_subscriptions')
          .update({ sub_status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);

        await supabase.from('user_settings')
          .update({ plan: 'gratis' })
          .eq('user_id', userId);

        console.log(`[Stripe webhook] subscription deleted: user=${userId} → gratis`);
        break;
      }

      case 'customer.subscription.paused': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabase.from('paywatch_subscriptions')
          .update({ sub_status: 'paused', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);

        // Paused = no access
        await supabase.from('user_settings')
          .update({ plan: 'gratis' })
          .eq('user_id', userId);

        console.log(`[Stripe webhook] subscription paused: user=${userId}`);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Trial ends in 3 days — log it, could trigger email later
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        console.log(`[Stripe webhook] trial_will_end: user=${userId} sub=${sub.id}`);
        // TODO: send trial ending email via Resend
        break;
      }

      // ── Invoices ────────────────────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;

        await supabase.from('paywatch_subscriptions')
          .update({ sub_status: 'active', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subId);

        console.log(`[Stripe webhook] invoice paid: sub=${subId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;

        await supabase.from('paywatch_subscriptions')
          .update({ sub_status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subId);

        console.log(`[Stripe webhook] invoice payment failed: sub=${subId}`);
        break;
      }

      // ── Checkout ────────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        if (!userId || !planId || session.mode !== 'subscription') break;

        if (session.customer) {
          await supabase.from('paywatch_subscriptions')
            .update({ stripe_customer_id: session.customer })
            .eq('user_id', userId)
            .eq('plan_id', planId);
        }
        break;
      }
    }
  } catch (err) {
    console.error('[Stripe webhook] Handler error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
