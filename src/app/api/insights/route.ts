import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateInsight } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => {
    if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT');
  };

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  // Check API key before doing anything
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Set it in Vercel environment variables.' },
      { status: 500, headers: NO_CACHE }
    );
  }

  try {
    guard();
    const supabase = await createServerSupabaseClient();

    const { data: settings } = await supabase
      .from('user_settings')
      .select('language')
      .eq('user_id', userId)
      .single();

    const language = settings?.language || 'nl';

    guard();
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('id, vendor, amount, due_date, status, escalation_stage, category, paid_date, is_recurring')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
      .limit(50);

    if (billsError) {
      console.error('Bills fetch error:', billsError);
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

    guard();
    const result = await generateInsight(bills, userId, language);

    return NextResponse.json(result, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504, headers: NO_CACHE });
    }
    console.error('Insights error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate insights';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE });
  }
}
