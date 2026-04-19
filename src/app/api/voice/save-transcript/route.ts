import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * POST /api/voice/save-transcript
 * Saves voice call transcript to chat_messages table.
 * Called when voice call ends (onDisconnect).
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { messages } = await req.json();
    if (!messages?.length) return NextResponse.json({ success: true }, { headers: NO_CACHE });

    const supabase = await createServerSupabaseClient();

    // Build chat messages from transcript
    const rows = messages
      .filter((m: { text?: string }) => m.text?.trim())
      .map((m: { role: string; text: string; ts: number }) => ({
        user_id: userId,
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
        metadata: { source: 'voice_call' },
        created_at: new Date(m.ts).toISOString(),
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from('chat_messages').insert(rows);
      if (error) console.error('Transcript save error:', error);
    }

    return NextResponse.json({ success: true, saved: rows.length }, { headers: NO_CACHE });
  } catch (error) {
    console.error('Save transcript error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
