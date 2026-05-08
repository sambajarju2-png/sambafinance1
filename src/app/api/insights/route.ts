import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateInsight } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';

const ADMIN_EMAILS = ['sambajarju2@gmail.com', 'ayeitssamba@gmail.com', 'reiskenners@gmail.com'];

export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => { if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT'); };

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const allowed = await checkRateLimit(userId, 'insights', 20, 60);
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_CACHE });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500, headers: NO_CACHE });
  }

  try {
    guard();
    const supabase = await createServerSupabaseClient();

    // Parallel fetch: settings + auth + bills (independent queries)
    const [settingsResult, authResult, billsResult] = await Promise.all([
      supabase.from('user_settings').select('language, insight_count').eq('user_id', userId).single(),
      supabase.auth.getUser(),
      supabase.from('bills')
        .select('id, vendor, amount, due_date, status, escalation_stage, category, paid_date, is_recurring')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })
        .limit(50),
    ]);

    const settings = settingsResult.data;
    const authUser = authResult.data?.user;
    const bills = billsResult.data;
    const billsError = billsResult.error;
    const isAdmin = authUser?.email && ADMIN_EMAILS.includes(authUser.email.toLowerCase());

    if (!isAdmin) {
      const { data: referrals } = await supabase
        .from('referrals')
        .select('id')
        .eq('referrer_id', userId)
        .eq('status', 'completed');

      const currentCount = settings?.insight_count || 0;

      // Read plan-based limit from plan_rules
      const userPlan = settings?.plan || 'gratis';
      const { data: planRule } = await supabase
        .from('plan_rules')
        .select('ai_insights_per_month')
        .eq('plan_id', userPlan)
        .single();

      let maxInsights = planRule?.ai_insights_per_month ?? 2;

      // -1 means unlimited
      if (maxInsights === -1) maxInsights = 999999;

      // Bonus: referrals still add extra insights on top of plan limit
      const completedReferrals = referrals?.length || 0;
      if (completedReferrals > 0) maxInsights += completedReferrals * 5;

      if (currentCount >= maxInsights) {
        return NextResponse.json({
          error: 'insight_limit',
          current: currentCount,
          max: maxInsights,
          plan: userPlan,
        }, { status: 403, headers: NO_CACHE });
      }
    }

    const language = settings?.language || 'nl';

    guard();

    if (billsError) return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500, headers: NO_CACHE });

    if (!bills || bills.length === 0) {
      return NextResponse.json({
        insights: [],
        summary: language === 'nl'
          ? 'Je hebt nog geen rekeningen. Voeg rekeningen toe om inzichten te krijgen.'
          : 'You have no bills yet. Add bills to get insights.',
      }, { headers: NO_CACHE });
    }

    guard();
    const result = await generateInsight(bills, userId, language);

    // Increment counter
    await supabase.from('user_settings').update({
      insight_count: (settings?.insight_count || 0) + 1,
    }).eq('user_id', userId);

    return NextResponse.json(result, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') return NextResponse.json({ error: 'Timeout' }, { status: 504, headers: NO_CACHE });
    console.error('Insights error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
