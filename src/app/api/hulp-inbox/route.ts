import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/hulp-inbox
 * Auto-seeds:
 *  1. Gemeente welcome on first visit
 *  2. Coach intro thread for each assigned B2B coach (if not yet seeded)
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();
    const serviceClient = createServiceRoleClient();
    const threadId = req.nextUrl.searchParams.get('thread_id');

    if (threadId) {
      const { data: messages } = await supabase
        .from('hulp_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      await supabase
        .from('hulp_messages')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .eq('is_read', false);

      return NextResponse.json({ messages: messages || [] }, { headers: NO_CACHE });
    }

    let { data: allMessages } = await supabase
      .from('hulp_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Fetch user settings once (used for personalisation in both seed paths)
    const { data: settings } = await supabase
      .from('user_settings')
      .select('gemeente, first_name')
      .eq('user_id', userId)
      .single();

    const firstName = settings?.first_name || '';
    const greeting = firstName ? `Hoi ${firstName}!` : 'Hoi!';
    let needsRefetch = false;

    // ── AUTO-SEED 1: gemeente welcome on very first visit ──
    if (!allMessages || allMessages.length === 0) {
      if (settings?.gemeente) {
        const { data: org } = await supabase
          .from('gemeente_schuldhulp')
          .select('gemeente, organisation_name, organisation_url')
          .ilike('gemeente', settings.gemeente)
          .limit(1)
          .single();

        if (org) {
          const threadKey = `org:${org.organisation_name.toLowerCase().replace(/\s+/g, '-')}`;
          await serviceClient.from('hulp_messages').insert([
            {
              user_id: userId,
              thread_id: threadKey,
              sender_type: 'gemeente',
              sender_name: org.organisation_name,
              content: `${greeting} Welkom bij ${org.organisation_name}. We helpen inwoners van ${org.gemeente} met geldzorgen en schulden. Als je vragen hebt of hulp nodig hebt, stuur gerust een berichtje. We zijn er voor je.`,
              is_read: false,
            },
            {
              user_id: userId,
              thread_id: threadKey,
              sender_type: 'gemeente',
              sender_name: org.organisation_name,
              content: `We bieden gratis en vrijblijvend een eerste gesprek aan. Geen wachtlijst, geen verplichtingen. Meer info: ${org.organisation_url}`,
              is_read: false,
            },
          ]);
          await serviceClient.from('hulp_messages').insert({
            user_id: userId,
            thread_id: 'org:schuldhulproute',
            sender_type: 'hulpinstantie',
            sender_name: 'Nationale Schuldhulproute',
            content: `${greeting} Via de Nationale Schuldhulproute kun je gratis en anoniem hulp krijgen. Bel 0800-8115 of bezoek geldfit.nl. We verwijzen je door naar de juiste hulp in jouw gemeente.`,
            is_read: false,
          });
          needsRefetch = true;
        }
      }
    }

    // ── AUTO-SEED 2: coach intro thread for each assigned B2B coach ──
    const { data: buddies } = await serviceClient
      .from('b2b_buddies')
      .select('id, buddy_member_id, organization_id')
      .eq('user_id', userId)
      .is('ended_at', null);

    if (buddies && buddies.length > 0) {
      // Use existing allMessages or re-read if gemeente was just seeded
      let existingThreadIds: string[];
      if (needsRefetch) {
        const { data: threads } = await supabase
          .from('hulp_messages')
          .select('thread_id')
          .eq('user_id', userId);
        existingThreadIds = (threads || []).map((m: any) => m.thread_id);
      } else {
        existingThreadIds = (allMessages || []).map((m: any) => m.thread_id);
      }

      for (const buddy of buddies) {
        const coachThreadId = `coach:${buddy.id}`;
        if (existingThreadIds.includes(coachThreadId)) continue;

        const { data: member } = await serviceClient
          .from('organization_members')
          .select('invite_email, full_name')
          .eq('id', buddy.buddy_member_id)
          .single();

        const { data: org } = await serviceClient
          .from('organizations')
          .select('name')
          .eq('id', buddy.organization_id)
          .single();

        if (member && org) {
          // Prefer full_name, fall back to email prefix
          const coachName = member.full_name || member.invite_email?.split('@')[0] || 'Coach';
          await serviceClient.from('hulp_messages').insert({
            user_id: userId,
            thread_id: coachThreadId,
            sender_type: 'coach',
            sender_name: coachName,
            content: `${greeting} Ik ben jouw coach bij ${org.name}. Je kunt hier altijd terecht met vragen over je financiën. Ik kijk met je mee en help je graag verder.`,
            is_read: false,
          });
          needsRefetch = true;
        }
      }
    }

    if (needsRefetch) {
      const { data: seeded } = await supabase
        .from('hulp_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      allMessages = seeded;
    }

    // Group into threads
    const threadMap = new Map<string, {
      thread_id: string;
      sender_name: string;
      sender_type: string;
      last_message: string;
      last_at: string;
      unread: number;
      total: number;
    }>();

    for (const msg of (allMessages || [])) {
      const existing = threadMap.get(msg.thread_id);
      if (!existing) {
        const senderInfo = msg.sender_type === 'user'
          ? (allMessages || []).find((m: any) => m.thread_id === msg.thread_id && m.sender_type !== 'user')
          : msg;
        threadMap.set(msg.thread_id, {
          thread_id: msg.thread_id,
          sender_name: senderInfo?.sender_name || msg.sender_name,
          sender_type: senderInfo?.sender_type || msg.sender_type,
          last_message: msg.content.length > 80 ? msg.content.slice(0, 80) + '...' : msg.content,
          last_at: msg.created_at,
          unread: msg.is_read ? 0 : 1,
          total: 1,
        });
      } else {
        existing.total += 1;
        if (!msg.is_read) existing.unread += 1;
      }
    }

    const threads = Array.from(threadMap.values())
      .sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());

    const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);

    return NextResponse.json({ threads, total_unread: totalUnread }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Hulp inbox GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

/**
 * POST /api/hulp-inbox
 * User replies to a thread. User CANNOT create new threads.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const body = await req.json();
    const { thread_id, content } = body;

    if (!thread_id || !content?.trim()) {
      return NextResponse.json({ error: 'thread_id and content required' }, { status: 400, headers: NO_CACHE });
    }

    const supabase = await createServerSupabaseClient();

    const { data: existing } = await supabase
      .from('hulp_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('thread_id', thread_id)
      .limit(1)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Thread niet gevonden' }, { status: 404, headers: NO_CACHE });
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('first_name, display_name')
      .eq('user_id', userId)
      .single();

    const senderName = settings?.display_name || settings?.first_name || 'Jij';

    const { data: message, error } = await supabase
      .from('hulp_messages')
      .insert({
        user_id: userId,
        thread_id,
        sender_type: 'user',
        sender_name: senderName,
        content: content.trim(),
        is_read: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to send' }, { status: 500, headers: NO_CACHE });
    }

    // Reverse bridge: replying to a coach thread → also write to b2b_buddy_messages
    if (thread_id.startsWith('coach:')) {
      try {
        const buddyLinkId = thread_id.replace('coach:', '');
        const serviceClient = createServiceRoleClient();
        await serviceClient.from('b2b_buddy_messages').insert({
          buddy_link_id: buddyLinkId,
          sender_id: userId,
          content: content.trim(),
          is_read: false,
        });
      } catch (bridgeErr) {
        console.error('[HulpInbox] b2b bridge error:', bridgeErr);
      }
    }

    return NextResponse.json({ message }, { status: 201, headers: NO_CACHE });
  } catch (error) {
    console.error('Hulp inbox POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
