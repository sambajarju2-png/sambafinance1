import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { LOCALES, DEFAULT_LOCALE } from '@/i18n/locale-meta';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * POST /api/settings/language
 * Body: { language: <one of LOCALES> }
 * Updates user_settings + sets the CORRECT locale cookie.
 * Unknown / missing values fall back to the default locale.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();
    const requested = typeof body.language === 'string' ? body.language : '';
    const language = (LOCALES as readonly string[]).includes(requested) ? requested : DEFAULT_LOCALE;

    const supabase = await createServerSupabaseClient();
    await supabase.from('user_settings').update({ language }).eq('user_id', userId);

    // CRITICAL: cookie name must match src/i18n/routing.ts → 'paywatch-locale'
    const response = NextResponse.json({ ok: true, language }, { headers: NO_CACHE });
    response.cookies.set('paywatch-locale', language, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Language switch error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
