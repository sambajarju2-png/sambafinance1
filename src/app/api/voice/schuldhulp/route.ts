import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/voice/schuldhulp
 * Returns schuldhulp organization info based on user's gemeente.
 * Called by the get_schuldhulp client tool during voice calls.
 * 
 * Also accepts ?gemeente=Rotterdam query param for direct lookup.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();
    const gemeenteParam = req.nextUrl.searchParams.get('gemeente');

    // Get gemeente from param or user settings
    let gemeente = gemeenteParam;
    if (!gemeente) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('gemeente')
        .eq('user_id', userId)
        .single();
      gemeente = settings?.gemeente;
    }

    if (!gemeente) {
      return NextResponse.json({
        found: false,
        message: 'Geen gemeente bekend. Vraag de gebruiker in welke gemeente ze wonen.',
        general_help: {
          name: 'Nationale Schuldhulproute',
          phone: '0800-8115',
          url: 'https://geldfit.nl',
          note: 'Gratis en anoniem. Helpt je naar de juiste lokale hulp.',
        },
      }, { headers: NO_CACHE });
    }

    // Fuzzy search: try exact, then ilike
    let { data: result } = await supabase
      .from('gemeente_schuldhulp')
      .select('gemeente, organisation_name, organisation_url, organisation_type, coverage_note')
      .ilike('gemeente', gemeente)
      .limit(1)
      .single();

    // If no exact match, try partial
    if (!result) {
      const { data: partial } = await supabase
        .from('gemeente_schuldhulp')
        .select('gemeente, organisation_name, organisation_url, organisation_type, coverage_note')
        .ilike('gemeente', `%${gemeente}%`)
        .limit(1)
        .single();
      result = partial;
    }

    if (!result) {
      return NextResponse.json({
        found: false,
        gemeente,
        message: `Geen specifieke schuldhulporganisatie gevonden voor ${gemeente}.`,
        general_help: {
          name: 'Nationale Schuldhulproute',
          phone: '0800-8115',
          url: 'https://geldfit.nl',
          note: 'Bel gratis 0800-8115, zij verwijzen je door naar hulp in jouw gemeente.',
        },
      }, { headers: NO_CACHE });
    }

    return NextResponse.json({
      found: true,
      gemeente: result.gemeente,
      organisation: {
        name: result.organisation_name,
        url: result.organisation_url,
        type: result.organisation_type,
        note: result.coverage_note,
      },
      general_help: {
        name: 'Nationale Schuldhulproute',
        phone: '0800-8115',
        url: 'https://geldfit.nl',
      },
      juridisch_loket: {
        phone: '0900-8020',
        url: 'https://www.juridischloket.nl',
      },
      summary: `In ${result.gemeente} kun je terecht bij ${result.organisation_name} (${result.organisation_type}). Website: ${result.organisation_url}. Of bel gratis de Nationale Schuldhulproute: 0800-8115.`,
    }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Schuldhulp lookup error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
