import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateInsight } from '@/lib/ai';

/**
 * POST /api/insights
 *
 * On-demand AI analysis of user's bills.
 * Only triggered when user taps "Analyseer" button.
 * Cost: ~$0.001 per analysis.
 */
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => {
    if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT');
  };

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    guard();
    const supabase = await createServerSupabaseClient();

    // Fetch user's language preference
    const { data: settings } = await supabase
      .from('user_settings')
      .select('language')
      .eq('user_id', userId)
      .single();

    const language = settings?.language || 'nl';

    // Fetch user's bills (non-settled only for insights, plus recent settled for patterns)
    guard();
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('id, vendor, amount, due_date, status, escalation_stage, category, paid_date, is_recurring')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
      .limit(50);

    if (billsError) {
      return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500, headers: NO_CACHE });
    }

    if (!bills || bills.length === 0) {
      return NextResponse.json({
        insights: [],
        summary: language === 'nl'
          ? 'Je hebt nog geen rekeningen. Voeg rekeningen toe om inzichten te krijgen.'
          : 'You have no bills yet. Add bills to get insights.',
      }, { headers: NO_CACHE });
    }

    // Generate insights with Haiku
    guard();
    const result = await generateInsight(bills, userId, language);

    return NextResponse.json(result, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504, headers: NO_CACHE });
    }
    console.error('Insights error:', err);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500, headers: NO_CACHE });
  }
}
