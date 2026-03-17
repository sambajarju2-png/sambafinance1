import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/gemeente?gemeente=Rotterdam
 *
 * Returns schuldhulp links for a given gemeente.
 * Also returns the user's saved gemeente if no param.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  const supabase = await createServerSupabaseClient();
  const gemeenteParam = req.nextUrl.searchParams.get('gemeente');

  // If no gemeente param, fetch user's saved gemeente
  let gemeente = gemeenteParam;
  if (!gemeente) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('gemeente')
      .eq('user_id', userId)
      .single();
    gemeente = settings?.gemeente || null;
  }

  if (!gemeente) {
    return NextResponse.json({ gemeente: null, links: [] }, { headers: NO_CACHE });
  }

  // Fetch schuldhulp links for this gemeente
  const { data: links } = await supabase
    .from('gemeente_schuldhulp')
    .select('gemeente, official_url, organisation_name, organisation_url, organisation_type, coverage_note')
    .eq('gemeente', gemeente);

  return NextResponse.json({
    gemeente,
    links: links || [],
  }, { headers: NO_CACHE });
}

/**
 * POST /api/gemeente
 *
 * Save user's gemeente preference.
 * Body: { gemeente: string }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  const body = await req.json();
  const { gemeente } = body;

  const supabase = await createServerSupabaseClient();

  await supabase
    .from('user_settings')
    .update({ gemeente: gemeente || null })
    .eq('user_id', userId);

  return NextResponse.json({ ok: true, gemeente }, { headers: NO_CACHE });
}
