import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/feedback — checks if user is eligible (account 3+ days old, no feedback yet)
 * POST /api/feedback — saves user feedback (rating 1-5 + optional text)
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ eligible: false }, { headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    // Check if already submitted
    const { data: existing } = await supabase
      .from('user_feedback')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ eligible: false, already_submitted: true }, { headers: NO_CACHE });
    }

    // Check account age (3+ days)
    const { data: settings } = await supabase
      .from('user_settings')
      .select('created_at')
      .eq('user_id', userId)
      .single();

    if (!settings?.created_at) {
      return NextResponse.json({ eligible: false }, { headers: NO_CACHE });
    }

    const createdAt = new Date(settings.created_at);
    const now = new Date();
    const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    return NextResponse.json({
      eligible: daysSinceCreation >= 3,
      already_submitted: false,
      days_since_creation: Math.floor(daysSinceCreation),
    }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ eligible: false }, { headers: NO_CACHE });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const { rating, feedback_text } = await req.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400, headers: NO_CACHE });
    }

    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.from('user_feedback').insert({
      user_id: userId,
      rating: Math.round(rating),
      feedback_text: feedback_text?.trim() || null,
    });

    if (error) {
      console.error('Feedback insert error:', error);
      return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json({ ok: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_CACHE });
  }
}
