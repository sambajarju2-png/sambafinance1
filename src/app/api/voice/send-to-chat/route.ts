import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * POST /api/voice/send-to-chat
 * Called by the voice agent's send_to_chat client tool.
 * Inserts a message into chat_messages so it appears in the chat history.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { message, type } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400, headers: NO_CACHE });

    const supabase = await createServerSupabaseClient();

    await supabase.from('chat_messages').insert({
      user_id: userId,
      role: 'assistant',
      content: message,
      metadata: {
        source: 'voice_to_chat',
        type: type || 'note',
      },
    });

    return NextResponse.json({ success: true }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Send to chat error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
