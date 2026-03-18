import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * POST /api/settings/language
 * Body: { language: 'nl' | 'en' }
 * Updates user_settings + sets locale cookie.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();
    const language = body.language === 'en' ? 'en' : 'nl';

    const supabase = await createServerSupabaseClient();
    await supabase.from('user_settings').update({ language }).eq('user_id', userId);

    // Set locale cookie
    const cookieStore = await cookies();
    cookieStore.set('locale', language, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
    });

    return NextResponse.json({ ok: true, language }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Language switch error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
