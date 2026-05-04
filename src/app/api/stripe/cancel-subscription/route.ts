import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503, headers: NO_CACHE });

  const serviceClient = createServiceRoleClient();

  const { data: sub } = await serviceClient
    .from('paywatch_subscriptions')
    .select('stripe_subscription_id, sub_status, cancel_at_end')
    .eq('user_id', userId)
    .eq('payment_provider', 'stripe')
    .not('stripe_subscription_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: 'Geen actief abonnement gevonden' }, { status: 404, headers: NO_CACHE });
  }

  // Already marked for cancellation
  if (sub.cancel_at_end) {
    return NextResponse.json({ ok: true, already_canceled: true }, { headers: NO_CACHE });
  }

  // Already fully canceled in Stripe
  if (sub.sub_status === 'canceled') {
    await serviceClient
      .from('paywatch_subscriptions')
      .update({ cancel_at_end: true, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.stripe_subscription_id);
    await serviceClient.from('user_settings').update({ plan: 'gratis' }).eq('user_id', userId);
    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as const });

    // Retrieve the subscription first to check its actual Stripe status
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

    if (stripeSub.status === 'canceled') {
      // Already canceled in Stripe — just update our DB
      await serviceClient
        .from('paywatch_subscriptions')
        .update({ sub_status: 'canceled', cancel_at_end: true, updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.stripe_subscription_id);
      await serviceClient.from('user_settings').update({ plan: 'gratis' }).eq('user_id', userId);
      return NextResponse.json({ ok: true }, { headers: NO_CACHE });
    }

    // Cancel at period end (keeps access until billing period ends)
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Update local record with real period_end from Stripe
    await serviceClient
      .from('paywatch_subscriptions')
      .update({
        cancel_at_end: true,
        period_end: new Date(updated.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', sub.stripe_subscription_id);

    return NextResponse.json({ ok: true }, { headers: NO_CACHE });

  } catch (err: any) {
    console.error('[cancel-subscription] Stripe error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
