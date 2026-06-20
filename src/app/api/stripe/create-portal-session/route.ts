import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserIdVerified, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const userId = await getAuthUserIdVerified(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503, headers: NO_CACHE });

  // Get stripe_customer_id from paywatch_subscriptions
  const supabase = await createServerSupabaseClient();
  const { data: sub } = await supabase
    .from('paywatch_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'Geen actief abonnement gevonden' }, { status: 404, headers: NO_CACHE });
  }

  // Dynamic import to avoid build error when stripe not installed
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as const });

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app'}/instellingen?tab=abonnement`,
  });

  return NextResponse.json({ url: session.url }, { headers: NO_CACHE });
}
