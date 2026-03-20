import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/referral — get user's referral code + status
 * POST /api/referral — send invite (creates referral record)
 * PUT /api/referral — complete referral (called when referred user signs up)
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    const { data: settings } = await supabase
      .from('user_settings')
      .select('referral_code, stats_unlocked')
      .eq('user_id', userId)
      .single();

    // Get referral stats
    const { data: referrals } = await supabase
      .from('referrals')
      .select('id, referred_email, status, created_at, completed_at')
      .eq('referrer_id', userId);

    const completedCount = (referrals || []).filter((r: { status: string }) => r.status === 'completed').length;

    // Auto-generate referral code if missing
    let code = settings?.referral_code;
    if (!code) {
      code = `PW-${userId.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await supabase.from('user_settings').update({ referral_code: code }).eq('user_id', userId);
    }

    return NextResponse.json({
      referral_code: code,
      stats_unlocked: settings?.stats_unlocked || false,
      referrals: referrals || [],
      completed_count: completedCount,
      share_url: `https://app.hypesamba.com/auth/signup?ref=${code}`,
    }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { email } = await req.json();
    const supabase = await createServerSupabaseClient();

    const { data: settings } = await supabase
      .from('user_settings')
      .select('referral_code')
      .eq('user_id', userId)
      .single();

    if (!settings?.referral_code) {
      return NextResponse.json({ error: 'No referral code' }, { status: 400, headers: NO_CACHE });
    }

    // Create referral record
    await supabase.from('referrals').insert({
      referrer_id: userId,
      referral_code: settings.referral_code,
      referred_email: email || null,
      status: 'pending',
    });

    return NextResponse.json({ ok: true, share_url: `https://app.hypesamba.com/auth/signup?ref=${settings.referral_code}` }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
