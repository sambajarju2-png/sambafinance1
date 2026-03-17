import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

/**
 * GET /api/landing
 * Returns all landing page content from the landing_content table.
 * Public — no auth needed. Cached for 60s.
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from('landing_content')
      .select('key, value');

    if (error) {
      console.error('Landing content error:', error);
      return NextResponse.json({ content: {} }, { headers: CACHE_HEADERS });
    }

    const content: Record<string, string> = {};
    for (const row of data || []) {
      content[row.key] = row.value;
    }

    return NextResponse.json({ content }, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ content: {} }, { headers: CACHE_HEADERS });
  }
}
