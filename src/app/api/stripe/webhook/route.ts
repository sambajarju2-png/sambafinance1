import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Map Stripe price ID → PayWatch plan_id
 */
function planFromPrice(priceId: string | null | undefined): string {
  if (!priceId) return 'gratis';
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) return 'pro_monthly';
  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return 'pro_yearly';
  if (priceId === process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID) return 'premium_monthly';
  if (priceId === process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID) return 'premium_yearly';
  return 'gratis';
}

/**
 * Resolve user_id — first from subscription metadata (set via subscription_data.metadata),
 * then fall back to customer lookup in our DB.
 */
async function resolveUserId(supabase: any, customerId: string, subMetadata: any): Promise<string | null> {
  // 1. From subscription_data.metadata.user_id (set in checkout session creation)
  if (subMetadata?.user_id) return subMetadata.user_id;

  // 2. Look up by stripe_customer_id in our DB
  if (customerId) {
    const { data } = await supabase
      .from('paywatch_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  return null;
}

/**
 * Upsert subscription row + update user plan.
 * Conflicts on (user_id, payment_provider) — the only proper UNIQUE constraint.
 */
async function upsertSubscription(supabase: any, userId: string, row: Record<string, any>) {
  const { error } = await supabase
    .from('paywatch_subscriptions')
    .upsert(
      { ...row, user_id: userId },
      { onConflict: 'user_id,payment_provider' }
    );

  if (error) {
    console.error('[Stripe webhook] DB upsert error:', JSON.stringify(error));
    throw new Error(`DB upsert failed: ${error.message}`);
  }

  // Update user plan field
  const activePlan = ['active', 'trialing'].includes(row.sub_status) ? row.plan_id : 'gratis';
  await supabase
    .from('user_settings')
    .update({ plan: activePlan })
    .eq('user_id', userId);

  console.log(`[Stripe webhook] upsert OK: user=${userId} plan=${activePlan} status=${row.sub_status} sub=${row.stripe_subscription_id}`);
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    console.error('[Stripe webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
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

      // ── Subscription created / updated ───────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.resumed':
      case 'customer.subscription.pending_update_applied': {
        const sub = event.data.object;
        const userId = await resolveUserId(supabase, sub.customer, sub.metadata);

        if (!userId) {
          console.warn(`[Stripe webhook] ${event.type}: no user_id for sub=${sub.id} customer=${sub.customer}`);
          break;
        }

        const priceId = sub.items?.data?.[0]?.price?.id;
        const planId = planFromPrice(priceId);

        await upsertSubscription(supabase, userId, {
          plan_id: planId,
          payment_provider: 'stripe',
          sub_status: sub.status,
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
          period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          cancel_at_end: sub.cancel_at_period_end ?? false,
          amount_cents: sub.items?.data?.[0]?.price?.unit_amount ?? 0,
          currency: sub.currency ?? 'eur',
          updated_at: new Date().toISOString(),
        });
        break;
      }

      // ── Subscription deleted (cancelled) ─────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = await resolveUserId(supabase, sub.customer, sub.metadata);

        // Mark as canceled in our DB
        await supabase
          .from('paywatch_subscriptions')
          .update({ sub_status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', sub.customer);

        // Downgrade user to free
        if (userId) {
          await supabase.from('user_settings').update({ plan: 'gratis' }).eq('user_id', userId);
        }
        console.log(`[Stripe webhook] subscription.deleted: customer=${sub.customer} → gratis`);
        break;
      }

      // ── Subscription paused ──────────────────────────────────────────────
      case 'customer.subscription.paused': {
        const sub = event.data.object;
        const userId = await resolveUserId(supabase, sub.customer, sub.metadata);
        await supabase
          .from('paywatch_subscriptions')
          .update({ sub_status: 'paused', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', sub.customer);
        if (userId) {
          await supabase.from('user_settings').update({ plan: 'gratis' }).eq('user_id', userId);
        }
        break;
      }

      // ── Trial ending soon (3 days before) ───────────────────────────────
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object;
        const userId = await resolveUserId(supabase, sub.customer, sub.metadata);
        console.log(`[Stripe webhook] trial_will_end: user=${userId} sub=${sub.id}`);
        // TODO: send Resend email + push notification
        break;
      }

      // ── Invoice paid → ensure status is active ───────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;
        await supabase
          .from('paywatch_subscriptions')
          .update({ sub_status: 'active', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', invoice.subscription);
        console.log(`[Stripe webhook] invoice.paid: sub=${invoice.subscription}`);
        break;
      }

      // ── Invoice failed → mark past_due ──────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;
        await supabase
          .from('paywatch_subscriptions')
          .update({ sub_status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', invoice.subscription);
        console.log(`[Stripe webhook] invoice.payment_failed: sub=${invoice.subscription}`);
        break;
      }

      // ── Checkout completed — seed row immediately with user_id ───────────
      // This fires BEFORE subscription.created, so we can pre-link user_id
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        if (!userId || !planId || session.mode !== 'subscription') break;

        await upsertSubscription(supabase, userId, {
          plan_id: planId,
          payment_provider: 'stripe',
          sub_status: 'trialing',
          stripe_customer_id: session.customer ?? null,
          stripe_subscription_id: session.subscription ?? null,
          updated_at: new Date().toISOString(),
        });
        console.log(`[Stripe webhook] checkout.completed: user=${userId} plan=${planId} sub=${session.subscription}`);
        break;
      }
    }
  } catch (err: any) {
    console.error('[Stripe webhook] Handler error:', err?.message ?? err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
