import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Map RevenueCat product IDs → PayWatch plan IDs
function planFromProductId(productId: string | null | undefined): string {
  if (!productId) return 'gratis';
  if (productId.includes('premium_yearly')) return 'premium_yearly';
  if (productId.includes('premium')) return 'premium_monthly';
  if (productId.includes('pro_yearly')) return 'pro_yearly';
  if (productId.includes('pro')) return 'pro_monthly';
  return 'gratis';
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

  // Verify authorization header
  const authHeader = req.headers.get('authorization');
  if (webhookSecret && authHeader !== webhookSecret) {
    console.error('[RevenueCat webhook] Invalid authorization header');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body?.event;
  if (!event) return NextResponse.json({ received: true });

  const {
    type,
    app_user_id,         // This is the Supabase user_id we passed to logIn()
    product_id,
    period_type,
    expiration_at_ms,
    purchased_at_ms,
    store,
  } = event;

  const userId = app_user_id;
  if (!userId) {
    console.warn('[RevenueCat webhook] No app_user_id in event');
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceRoleClient();
  const planId = planFromProductId(product_id);

  console.log(`[RevenueCat webhook] ${type}: user=${userId} plan=${planId} product=${product_id}`);

  try {
    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION': {
        await supabase.from('paywatch_subscriptions').upsert({
          user_id: userId,
          plan_id: planId,
          payment_provider: 'revenuecat',
          sub_status: 'active',
          revenuecat_user_id: userId,
          period_start: purchased_at_ms ? new Date(purchased_at_ms).toISOString() : null,
          period_end: expiration_at_ms ? new Date(expiration_at_ms).toISOString() : null,
          cancel_at_end: false,
          currency: 'eur',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,payment_provider' });

        await supabase.from('user_settings').update({ plan: planId }).eq('user_id', userId);
        break;
      }

      case 'TRIAL_STARTED': {
        await supabase.from('paywatch_subscriptions').upsert({
          user_id: userId,
          plan_id: planId,
          payment_provider: 'revenuecat',
          sub_status: 'trialing',
          revenuecat_user_id: userId,
          trial_end: expiration_at_ms ? new Date(expiration_at_ms).toISOString() : null,
          period_end: expiration_at_ms ? new Date(expiration_at_ms).toISOString() : null,
          cancel_at_end: false,
          currency: 'eur',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,payment_provider' });

        await supabase.from('user_settings').update({ plan: planId }).eq('user_id', userId);
        break;
      }

      case 'CANCELLATION':
      case 'EXPIRATION': {
        await supabase.from('paywatch_subscriptions')
          .update({
            sub_status: type === 'CANCELLATION' ? 'canceled' : 'expired',
            cancel_at_end: type === 'CANCELLATION',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('payment_provider', 'revenuecat');

        // Only downgrade if expired (not just cancelled — they keep access until period end)
        if (type === 'EXPIRATION') {
          await supabase.from('user_settings').update({ plan: 'gratis' }).eq('user_id', userId);
        }
        break;
      }

      case 'BILLING_ISSUE': {
        await supabase.from('paywatch_subscriptions')
          .update({ sub_status: 'past_due', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('payment_provider', 'revenuecat');
        break;
      }
    }
  } catch (err: any) {
    console.error('[RevenueCat webhook] Handler error:', err?.message ?? err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
