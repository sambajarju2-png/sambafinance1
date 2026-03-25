/**
 * GET /api/outlook/accounts
 * 
 * Returns the user's connected Outlook accounts.
 * 
 * File: src/app/api/outlook/accounts/route.ts
 */

import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { getUserOutlookAccounts } from '@/lib/outlook-tokens';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
    }

    const accounts = await getUserOutlookAccounts(userId);

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('[Outlook Accounts] Error:', error);
    return NextResponse.json({ error: 'Kon accounts niet ophalen' }, { status: 500 });
  }
}
