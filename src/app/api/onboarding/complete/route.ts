import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();
    const { first_name, last_name, language } = body;

    // Validate first_name (required)
    if (!first_name || typeof first_name !== 'string' || first_name.trim().length === 0) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400, headers: NO_CACHE });
    }

    if (!['nl', 'en', 'pl', 'tr', 'fr', 'ar'].includes(language)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400, headers: NO_CACHE });
    }

    // Build display_name from first + last
    const trimmedFirst = first_name.trim();
    const trimmedLast = typeof last_name === 'string' ? last_name.trim() : '';
    const displayName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ');

    const supabase = await createServerSupabaseClient();

    // Generate unique referral code for this user
    const referralCode = `PW-${userId.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const { error: updateError } = await supabase
      .from('user_settings')
      .update({
        first_name: trimmedFirst,
        last_name: trimmedLast,
        display_name: displayName,
        language,
        onboarding_complete: true,
        referral_code: referralCode,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Onboarding update error:', updateError);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500, headers: NO_CACHE });
    }

    // Set locale cookie
    const cookieStore = await cookies();
    cookieStore.set('paywatch-locale', language, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Send welcome email in background (don't block the response)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hypesamba.com';
        fetch(`${baseUrl}/api/email/welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, name: displayName, language }),
        }).catch(() => {}); // Fire and forget
      }
    } catch { /* silent */ }

    return NextResponse.json({ success: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: NO_CACHE });
  }
}
