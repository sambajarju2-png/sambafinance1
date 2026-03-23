import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/buddy/invite?code=PW-B-XXXXXX
 * Public endpoint — returns inviter name + role for the accept page.
 * No auth required (so the page can show who invited you before login).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    const { data: invite } = await supabase
      .from('user_buddies')
      .select('user_id, role, status')
      .eq('invite_code', code)
      .single();

    if (!invite) {
      return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_CACHE });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'already_accepted' }, { status: 410, headers: NO_CACHE });
    }

    // Get inviter's name
    const { data: settings } = await supabase
      .from('user_settings')
      .select('display_name, first_name, last_name')
      .eq('user_id', invite.user_id)
      .single();

    const name = settings?.display_name
      || [settings?.first_name, settings?.last_name].filter(Boolean).join(' ')
      || 'Iemand';

    // Only return first name for privacy
    const firstName = settings?.first_name || name.split(' ')[0] || 'Iemand';

    return NextResponse.json({
      inviter_name: name,
      inviter_first_name: firstName,
      role: invite.role,
    }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
