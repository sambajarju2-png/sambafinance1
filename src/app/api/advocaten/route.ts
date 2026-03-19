import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CACHE = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' };

/**
 * GET /api/advocaten?stad=Amsterdam
 * Returns lawyer offices for a given city. Public, cached.
 */
export async function GET(req: NextRequest) {
  const stad = req.nextUrl.searchParams.get('stad');
  if (!stad) return NextResponse.json({ advocaten: [] }, { headers: CACHE });

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase
      .from('advocaten_kantoren')
      .select('kantoor_naam, website_url')
      .ilike('stad', stad.trim())
      .limit(5);

    return NextResponse.json({ advocaten: data || [] }, { headers: CACHE });
  } catch {
    return NextResponse.json({ advocaten: [] }, { headers: CACHE });
  }
}
