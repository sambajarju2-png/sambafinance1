import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { recalculateStreak } from '@/lib/streak';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }
  try {
    const streak = await recalculateStreak(userId);
    return NextResponse.json({ streak }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Streak error:', err);
    return NextResponse.json({ streak: 0 }, { headers: NO_CACHE });
  }
}
