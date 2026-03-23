import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/buddy/invite?code=PW-B-XXXXXX
 * Public endpoint — returns inviter name + role for the accept page.
 * No auth required. Uses service role to read data.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400, headers: NO_CACHE });

  try {
    const supabase = getServiceClient();

    const { data: invite, error: inviteErr } = await supabase
      .from('user_buddies')
      .select('user_id, role, status')
      .eq('invite_code', code)
      .single();

    if (inviteErr || !invite) {
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

    const fullName = settings?.display_name
      || [settings?.first_name, settings?.last_name].filter(Boolean).join(' ')
      || 'Iemand';

    const firstName = settings?.first_name || fullName.split(' ')[0] || 'Iemand';

    return NextResponse.json({
      inviter_name: fullName,
      inviter_first_name: firstName,
      role: invite.role,
    }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
