import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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

  // Get user email
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email;

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.paywatch.app';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card', 'ideal'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    metadata: { user_id: userId, plan_id },
    success_url: `${appUrl}/instellingen?tab=abonnement&success=1`,
    cancel_url: `${appUrl}/instellingen?tab=abonnement`,
    locale: 'nl',
  });

  return NextResponse.json({ url: session.url }, { headers: NO_CACHE });
}
