import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/gemeente/list
 *
 * Returns all unique gemeente names for the settings dropdown.
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('gemeente_schuldhulp')
    .select('gemeente')
    .order('gemeente');

  // Deduplicate
  const gemeentes = [...new Set((data || []).map((r) => r.gemeente))].sort();

  return NextResponse.json({ gemeentes }, { headers: NO_CACHE });
}
