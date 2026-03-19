import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/mood — Returns today's mood (if set)
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: mood } = await supabase
    .from('mood_log')
    .select('mood, logged_at')
    .eq('user_id', userId)
    .eq('logged_at', today)
    .maybeSingle();

  return NextResponse.json({ mood: mood?.mood || null, logged_today: !!mood }, { headers: NO_CACHE });
}

/**
 * POST /api/mood — Save today's mood + capture anonymous financial snapshot for analytics
 * Body: { mood: 'angstig' | 'gestrest' | 'neutraal' | 'opgelucht' | 'blij' }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const body = await req.json();
  const { mood } = body;

  const validMoods = ['angstig', 'gestrest', 'neutraal', 'opgelucht', 'blij'];
  if (!mood || !validMoods.includes(mood)) {
    return NextResponse.json({ error: 'Invalid mood' }, { status: 400, headers: NO_CACHE });
  }

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  // 1. Save mood to mood_log
  const { error } = await supabase
    .from('mood_log')
    .upsert({ user_id: userId, mood, logged_at: today }, { onConflict: 'user_id,logged_at' });

  if (error) {
    console.error('Mood save error:', error);
    return NextResponse.json({ error: 'Failed to save mood' }, { status: 500, headers: NO_CACHE });
  }

  // 2. Capture anonymous financial snapshot for mood analytics
  // This data can be analyzed later without identifying the user
  try {
    const { data: bills } = await supabase
      .from('bills')
      .select('status, due_date, amount, escalation_stage')
      .eq('user_id', userId);

    const allBills = bills || [];
    const outstanding = allBills.filter((b: { status: string }) => b.status !== 'settled');
    const overdue = outstanding.filter((b: { due_date: string }) => b.due_date < today);
    const settled = allBills.filter((b: { status: string }) => b.status === 'settled');

    const totalOutstandingCents = outstanding.reduce((s: number, b: { amount: number }) => s + b.amount, 0);
    const totalSettledCents = settled.reduce((s: number, b: { amount: number }) => s + b.amount, 0);

    // Find highest escalation stage
    const stageOrder = ['factuur', 'herinnering', 'aanmaning', 'incasso', 'deurwaarder'];
    let highestStage = 'factuur';
    for (const bill of outstanding) {
      const b = bill as { escalation_stage: string };
      const idx = stageOrder.indexOf(b.escalation_stage || 'factuur');
      if (idx > stageOrder.indexOf(highestStage)) highestStage = stageOrder[idx];
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('streak_current')
      .eq('user_id', userId)
      .single();

    await supabase.from('mood_analytics').upsert({
      user_id: userId,
      mood,
      total_bills: allBills.length,
      outstanding_bills: outstanding.length,
      overdue_bills: overdue.length,
      settled_bills: settled.length,
      total_outstanding_cents: totalOutstandingCents,
      total_settled_cents: totalSettledCents,
      highest_escalation: highestStage,
      streak_current: settings?.streak_current || 0,
      logged_at: today,
    }, { onConflict: 'user_id,logged_at' });
  } catch (err) {
    // Silent — analytics capture should never break the main flow
    console.error('Mood analytics capture error:', err);
  }

  return NextResponse.json({ ok: true, mood }, { headers: NO_CACHE });
}
