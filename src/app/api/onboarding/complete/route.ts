import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: NO_CACHE }
    );
  }

  try {
    const body = await req.json();
    const { display_name, language, scan_preference } = body;

    // Validate inputs
    if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400, headers: NO_CACHE }
      );
    }

    if (!['nl', 'en'].includes(language)) {
      return NextResponse.json(
        { error: 'Invalid language' },
        { status: 400, headers: NO_CACHE }
      );
    }

    if (!['gmail', 'camera', 'both'].includes(scan_preference)) {
      return NextResponse.json(
        { error: 'Invalid scan preference' },
        { status: 400, headers: NO_CACHE }
      );
    }

    // Update user settings
    const supabase = await createServerSupabaseClient();

    const { error: updateError } = await supabase
      .from('user_settings')
      .update({
        display_name: display_name.trim(),
        language,
        scan_preference,
        onboarding_complete: true,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Onboarding update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to save settings' },
        { status: 500, headers: NO_CACHE }
      );
    }

    // Set the locale cookie so next-intl picks up the new language immediately
    const cookieStore = await cookies();
    cookieStore.set('paywatch-locale', language, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return NextResponse.json(
      { success: true },
      { headers: NO_CACHE }
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400, headers: NO_CACHE }
    );
  }
}
