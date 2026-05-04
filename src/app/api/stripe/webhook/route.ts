import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// Stripe sends raw body — disable body parsing
export const dynamic = 'force-dynamic';

function planFromPrice(priceId: string | null | undefined): string {
  if (!priceId) return 'gratis';
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) return 'pro_monthly';
  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return 'pro_yearly';
  if (priceId === process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID) return 'premium_monthly';
  if (priceId === process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID) return 'premium_yearly';
  return 'gratis';
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
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' as const });
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        const priceId = sub.items?.data?.[0]?.price?.id;
        const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
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

        // Update user plan
        const activePlan = ['active', 'trialing'].includes(sub.status) ? planId : 'gratis';
        await supabase.from('user_settings')
          .update({ plan: activePlan })
          .eq('user_id', userId);

        console.log(`[Stripe webhook] ${event.type}: user=${userId} plan=${activePlan}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabase.from('paywatch_subscriptions')
          .update({
            sub_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        await supabase.from('user_settings')
          .update({ plan: 'gratis' })
          .eq('user_id', userId);

        console.log(`[Stripe webhook] subscription deleted: user=${userId} → gratis`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;

        await supabase.from('paywatch_subscriptions')
          .update({
            sub_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subId);

        console.log(`[Stripe webhook] invoice paid: sub=${subId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;

        await supabase.from('paywatch_subscriptions')
          .update({
            sub_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subId);

        console.log(`[Stripe webhook] invoice payment failed: sub=${subId}`);
        break;
      }

      // checkout.session.completed: link customer to user if not in metadata yet
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        if (!userId || !planId || session.mode !== 'subscription') break;

        // stripe_subscription_id will be handled by subscription.created event
        // Just ensure customer_id is linked
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
