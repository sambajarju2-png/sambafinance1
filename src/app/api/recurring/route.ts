import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    const { data: patterns } = await supabase
      .from('recurring_patterns')
      .select('*')
      .eq('user_id', userId)
      .gte('confidence', 0.4)
      .order('next_expected', { ascending: true });

    // Separate into upcoming (next 60 days) and later
    const now = new Date();
    const sixtyDays = new Date(now.getTime() + 60 * 86400000).toISOString().split('T')[0];

    const upcoming = (patterns || []).filter(p => p.next_expected <= sixtyDays);
    const totalExpected = upcoming.reduce((sum, p) => sum + (p.typical_amount || 0), 0);

    return NextResponse.json({
      patterns: patterns || [],
      upcoming,
      total_expected: totalExpected,
    }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Recurring fetch error:', err);
    return NextResponse.json({ patterns: [], upcoming: [], total_expected: 0 }, { headers: NO_CACHE });
  }
}
