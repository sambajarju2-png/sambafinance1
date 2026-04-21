import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/hulp-inbox
 * Returns all hulp message threads for the user.
 * Query params: ?thread_id=xxx (get messages for a specific thread)
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();
    const threadId = req.nextUrl.searchParams.get('thread_id');

    if (threadId) {
      // Get messages for a specific thread
      const { data: messages } = await supabase
        .from('hulp_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      // Mark all as read
      await supabase
        .from('hulp_messages')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .eq('is_read', false);

      return NextResponse.json({ messages: messages || [] }, { headers: NO_CACHE });
    }

    // Get all messages grouped by thread
    const { data: allMessages } = await supabase
      .from('hulp_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

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
        // First time seeing this thread (latest message, since sorted DESC)
        const senderInfo = msg.sender_type === 'user'
          ? (allMessages || []).find(m => m.thread_id === msg.thread_id && m.sender_type !== 'user')
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

    // Total unread count
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
 * Body: { thread_id: string, content: string }
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

    // Verify thread exists for this user (user can only reply to existing threads)
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

    // Get user's name for the message
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
        is_read: true, // User's own message is always "read"
      })
      .select()
      .single();

    if (error) {
      console.error('Hulp inbox POST error:', error);
      return NextResponse.json({ error: 'Failed to send' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ message }, { status: 201, headers: NO_CACHE });
  } catch (error) {
    console.error('Hulp inbox POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
