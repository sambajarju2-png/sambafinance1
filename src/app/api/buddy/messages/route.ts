import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/buddy/messages
 * List buddy conversations or get messages for a specific buddy link.
 * Query params:
 *   ?buddy_link_id=xxx — get messages for specific conversation
 *   (no params) — list all buddy conversations with last message + unread count
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();
    const serviceClient = createServiceRoleClient();
    const buddyLinkId = req.nextUrl.searchParams.get('buddy_link_id');

    if (buddyLinkId) {
      // Get messages for a specific conversation
      const { data: messages } = await supabase
        .from('buddy_messages')
        .select('*')
        .eq('buddy_link_id', buddyLinkId)
        .order('created_at', { ascending: true });

      // Mark unread messages as read (messages not sent by me)
      await supabase
        .from('buddy_messages')
        .update({ is_read: true })
        .eq('buddy_link_id', buddyLinkId)
        .neq('sender_id', userId)
        .eq('is_read', false);

      return NextResponse.json({ messages: messages || [] }, { headers: NO_CACHE });
    }

    // List all buddy conversations
    // Get all accepted buddy links where I'm either inviter or accepter
    const { data: asInviter } = await supabase
      .from('user_buddies')
      .select('id, user_id, buddy_user_id, role, accepted_at')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    const { data: asAccepter } = await supabase
      .from('user_buddies')
      .select('id, user_id, buddy_user_id, role, accepted_at')
      .eq('buddy_user_id', userId)
      .eq('status', 'accepted');

    const allLinks = [...(asInviter || []), ...(asAccepter || [])];

    if (allLinks.length === 0) {
      return NextResponse.json({ conversations: [] }, { headers: NO_CACHE });
    }

    // Get buddy names
    const otherUserIds = allLinks.map(link =>
      link.user_id === userId ? link.buddy_user_id : link.user_id
    ).filter(Boolean);

    const nameMap: Record<string, string> = {};
    if (otherUserIds.length > 0) {
      const { data: settings } = await serviceClient
        .from('user_settings')
        .select('user_id, display_name, first_name')
        .in('user_id', otherUserIds);

      for (const s of settings || []) {
        nameMap[s.user_id] = s.display_name || s.first_name || 'Onbekend';
      }
    }

    // Build conversation list with last message + unread count
    const conversations = [];
    for (const link of allLinks) {
      const otherUserId = link.user_id === userId ? link.buddy_user_id : link.user_id;

      // Get last message
      const { data: lastMsg } = await supabase
        .from('buddy_messages')
        .select('content, sender_id, created_at')
        .eq('buddy_link_id', link.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Count unread (messages not from me, not read)
      const { count: unreadCount } = await supabase
        .from('buddy_messages')
        .select('id', { count: 'exact', head: true })
        .eq('buddy_link_id', link.id)
        .neq('sender_id', userId)
        .eq('is_read', false);

      conversations.push({
        buddy_link_id: link.id,
        buddy_user_id: otherUserId,
        buddy_name: nameMap[otherUserId] || 'Onbekend',
        role: link.role,
        last_message: lastMsg ? {
          content: lastMsg.content.length > 60 ? lastMsg.content.slice(0, 60) + '...' : lastMsg.content,
          is_mine: lastMsg.sender_id === userId,
          created_at: lastMsg.created_at
        } : null,
        unread: unreadCount || 0,
        accepted_at: link.accepted_at
      });
    }

    // Sort by last message time (most recent first), null messages at end
    conversations.sort((a, b) => {
      if (!a.last_message && !b.last_message) return 0;
      if (!a.last_message) return 1;
      if (!b.last_message) return -1;
      return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
    });

    return NextResponse.json({ conversations }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Buddy messages GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}

/**
 * POST /api/buddy/messages
 * Send a message to a buddy.
 * Body: { buddy_link_id: string, content: string }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { buddy_link_id, content } = await req.json();

    if (!buddy_link_id || !content?.trim()) {
      return NextResponse.json({ error: 'buddy_link_id en content zijn verplicht' }, { status: 400, headers: NO_CACHE });
    }

    const supabase = await createServerSupabaseClient();

    // Insert message (RLS policy will verify the user is part of this buddy link)
    const { data: message, error } = await supabase
      .from('buddy_messages')
      .insert({
        buddy_link_id,
        sender_id: userId,
        content: content.trim()
      })
      .select()
      .single();

    if (error) {
      console.error('Buddy message send error:', error);
      // If RLS blocks it, the user is not part of this buddy link
      if (error.code === '42501') {
        return NextResponse.json({ error: 'Je bent geen buddy in deze verbinding' }, { status: 403, headers: NO_CACHE });
      }
      return NextResponse.json({ error: 'Bericht versturen mislukt' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ message }, { status: 201, headers: NO_CACHE });
  } catch (error) {
    console.error('Buddy messages POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
