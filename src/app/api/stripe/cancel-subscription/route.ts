import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503, headers: NO_CACHE });

  const serviceClient = createServiceRoleClient();

  // Get subscription
  const { data: sub } = await serviceClient
    .from('paywatch_subscriptions')
    .select('stripe_subscription_id, sub_status')
    .eq('user_id', userId)
    .eq('payment_provider', 'stripe')
    .not('stripe_subscription_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: 'Geen actief abonnement gevonden' }, { status: 404, headers: NO_CACHE });
  }

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as const });

  // Cancel at period end (not immediately)
  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  // Update local record
  await serviceClient
    .from('paywatch_subscriptions')
    .update({ cancel_at_end: true, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.stripe_subscription_id);

  return NextResponse.json({ ok: true }, { headers: NO_CACHE });
}
