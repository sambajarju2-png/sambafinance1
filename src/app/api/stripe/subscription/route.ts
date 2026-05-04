import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('paywatch_subscriptions')
    .select('plan_id, sub_status, period_end, cancel_at_end, payment_provider')
    .eq('user_id', userId)
    .in('sub_status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ subscription: data || null }, { headers: NO_CACHE });
}
