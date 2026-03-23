import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PW-B-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * GET /api/buddies — list my buddies + pending invites
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    // Buddies I invited
    const { data: myBuddies } = await supabase
      .from('user_buddies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Buddy invites where I'm the buddy
    const { data: buddyOf } = await supabase
      .from('user_buddies')
      .select('*')
      .eq('buddy_user_id', userId)
      .eq('status', 'accepted');

    // Get display names for buddy_user_ids
    const buddyUserIds = (myBuddies || [])
      .filter((b) => b.buddy_user_id)
      .map((b) => b.buddy_user_id);

    const ownerUserIds = (buddyOf || []).map((b) => b.user_id);
    const allUserIds = Array.from(new Set([...buddyUserIds, ...ownerUserIds]));

    let nameMap: Record<string, string> = {};
    if (allUserIds.length > 0) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('user_id, display_name, first_name, last_name')
        .in('user_id', allUserIds);

      for (const s of settings || []) {
        nameMap[s.user_id] = s.display_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Onbekend';
      }
    }

    // Enrich buddies
    const enrichedBuddies = (myBuddies || []).map((b) => ({
      ...b,
      buddy_name: b.buddy_user_id ? nameMap[b.buddy_user_id] || 'Onbekend' : null,
    }));

    // Enrich buddy_of (people who added me as buddy)
    const enrichedBuddyOf = (buddyOf || []).map((b) => ({
      ...b,
      owner_name: nameMap[b.user_id] || 'Onbekend',
    }));

    // Check if any owner has incasso bills (for status)
    const buddyStatuses: Record<string, 'green' | 'red'> = {};
    for (const b of enrichedBuddies) {
      if (b.buddy_user_id && b.status === 'accepted') {
        // Check if the USER (not buddy) has incasso bills - buddy sees user's status
        const { data: incassoBills } = await supabase
          .from('bills')
          .select('id')
          .eq('user_id', userId)
          .in('escalation_stage', ['incasso', 'deurwaarder'])
          .neq('status', 'settled')
          .limit(1);

        buddyStatuses[b.id] = (incassoBills && incassoBills.length > 0) ? 'red' : 'green';
      }
    }

    return NextResponse.json({
      buddies: enrichedBuddies,
      buddy_of: enrichedBuddyOf,
      statuses: buddyStatuses,
      max_buddies: 3,
    }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Buddies GET error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

/**
 * POST /api/buddies — create invite
 * Body: { role: string }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();
    const role = body.role || 'partner';
    const shareAmounts = body.share_amounts === true;
    const notifyOnIncasso = body.notify_on_incasso !== false; // default true
    const supabase = await createServerSupabaseClient();

    // Check max buddies (3)
    const { count } = await supabase
      .from('user_buddies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((count || 0) >= 3) {
      return NextResponse.json({ error: 'Je kunt maximaal 3 buddies uitnodigen' }, { status: 400, headers: NO_CACHE });
    }

    const inviteCode = generateInviteCode();

    const { data, error } = await supabase
      .from('user_buddies')
      .insert({
        user_id: userId,
        role,
        invite_code: inviteCode,
        status: 'pending',
        share_amounts: shareAmounts,
        notify_on_incasso: notifyOnIncasso,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });

    return NextResponse.json({ buddy: data, invite_url: `/buddy/accept/${inviteCode}` }, { status: 201, headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

/**
 * PATCH /api/buddies — accept invite or update settings
 * Body: { invite_code: string } (accept) or { id: string, share_amounts: boolean, notify_on_incasso: boolean } (update)
 */
export async function PATCH(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();
    const supabase = await createServerSupabaseClient();

    if (body.invite_code) {
      // Accept invite
      const { data: invite } = await supabase
        .from('user_buddies')
        .select('*')
        .eq('invite_code', body.invite_code)
        .eq('status', 'pending')
        .single();

      if (!invite) return NextResponse.json({ error: 'Uitnodiging niet gevonden of verlopen' }, { status: 404, headers: NO_CACHE });
      if (invite.user_id === userId) return NextResponse.json({ error: 'Je kunt jezelf niet als buddy toevoegen' }, { status: 400, headers: NO_CACHE });

      const { error } = await supabase
        .from('user_buddies')
        .update({ buddy_user_id: userId, status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
      return NextResponse.json({ ok: true, message: 'Uitnodiging geaccepteerd' }, { headers: NO_CACHE });
    }

    if (body.id) {
      // Update buddy settings
      const updates: Record<string, unknown> = {};
      if (typeof body.share_amounts === 'boolean') updates.share_amounts = body.share_amounts;
      if (typeof body.notify_on_incasso === 'boolean') updates.notify_on_incasso = body.notify_on_incasso;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Niets om bij te werken' }, { status: 400, headers: NO_CACHE });
      }

      await supabase.from('user_buddies').update(updates).eq('id', body.id).eq('user_id', userId);
      return NextResponse.json({ ok: true }, { headers: NO_CACHE });
    }

    return NextResponse.json({ error: 'Missing invite_code or id' }, { status: 400, headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

/**
 * DELETE /api/buddies — remove buddy
 * Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: NO_CACHE });

    const supabase = await createServerSupabaseClient();
    await supabase.from('user_buddies').delete().eq('id', id).eq('user_id', userId);
    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
