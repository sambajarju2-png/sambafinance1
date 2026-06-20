import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getGrantedFeatures } from '@/lib/org-features-server';

/**
 * GET — the effective org-granted feature map for the current user, with enforcement
 * already applied. Consumed by useOrgFeatures() on the client and reusable on the server.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = createServiceRoleClient();
  const granted = await getGrantedFeatures(supabase, userId);
  return NextResponse.json({ granted }, { headers: NO_CACHE });
}
