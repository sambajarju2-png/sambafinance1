import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * POST /api/settings/language
 * Body: { language: 'nl' | 'en' }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();
    const language = body.language === 'en' ? 'en' : 'nl';

    const supabase = await createServerSupabaseClient();
    await supabase.from('user_settings').update({ language }).eq('user_id', userId);

    // Set locale cookie via response headers
    const response = NextResponse.json({ ok: true, language }, { headers: NO_CACHE });
    response.cookies.set('locale', language, {
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
