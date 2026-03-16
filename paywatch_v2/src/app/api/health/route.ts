import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const NO_CACHE = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('user_settings').select('user_id').limit(1);

    return NextResponse.json(
      {
        status: 'ok',
        database: error ? 'error' : 'connected',
        timestamp: new Date().toISOString(),
      },
      { headers: NO_CACHE }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: NO_CACHE }
    );
  }
}
