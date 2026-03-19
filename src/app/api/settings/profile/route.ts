import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/settings/profile - returns profile data
 * POST /api/settings/profile - updates profile data
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();
    const { data: settings } = await supabase
      .from('user_settings')
      .select('display_name, first_name, last_name, date_of_birth, gemeente, language, dark_mode, notify_push_enabled, notify_email_welcome, notify_email_features, notify_email_digest, monthly_budget_cents')
      .eq('user_id', userId)
      .single();

    const { data: { user } } = await supabase.auth.getUser();

    return NextResponse.json({
      profile: {
        email: user?.email || '',
        ...settings,
      },
    }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();
    const supabase = await createServerSupabaseClient();

    const updates: Record<string, unknown> = {};

    if (typeof body.first_name === 'string') updates.first_name = body.first_name.trim();
    if (typeof body.last_name === 'string') updates.last_name = body.last_name.trim();
    if (body.date_of_birth) updates.date_of_birth = body.date_of_birth;
    if (typeof body.display_name === 'string') updates.display_name = body.display_name.trim();
    if (typeof body.notify_email_welcome === 'boolean') updates.notify_email_welcome = body.notify_email_welcome;
    if (typeof body.notify_email_features === 'boolean') updates.notify_email_features = body.notify_email_features;
    if (typeof body.notify_email_digest === 'boolean') updates.notify_email_digest = body.notify_email_digest;
    if (typeof body.notify_push_enabled === 'boolean') updates.notify_push_enabled = body.notify_push_enabled;
    if (typeof body.monthly_budget_cents === 'number') updates.monthly_budget_cents = body.monthly_budget_cents;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400, headers: NO_CACHE });
    }

    updates.updated_at = new Date().toISOString();

    await supabase.from('user_settings').update(updates).eq('user_id', userId);

    // Update display_name from first+last if both provided
    if (updates.first_name || updates.last_name) {
      const { data: current } = await supabase.from('user_settings').select('first_name, last_name').eq('user_id', userId).single();
      const fullName = [current?.first_name, current?.last_name].filter(Boolean).join(' ');
      if (fullName) {
        await supabase.from('user_settings').update({ display_name: fullName }).eq('user_id', userId);
      }
    }

    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Profile update error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
