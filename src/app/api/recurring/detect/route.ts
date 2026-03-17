import { NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { detectRecurringPatterns } from '@/lib/recurring';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const patterns = await detectRecurringPatterns(userId);
    return NextResponse.json({ patterns }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Recurring detection error:', err);
    return NextResponse.json({ patterns: [] }, { headers: NO_CACHE });
  }
}
