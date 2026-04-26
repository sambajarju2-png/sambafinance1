import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie');
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            if (!cookieHeader) return [];
            return cookieHeader.split(';').map(c => {
              const [name, ...rest] = c.trim().split('=');
              return { name, value: rest.join('=') };
            });
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
    }

    const months = parseInt(req.nextUrl.searchParams.get('months') || '6');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.rpc('get_analytics_bundle', {
      p_user_id: user.id,
      p_months: months,
    });

    if (error) {
      console.error('[Analytics] RPC error:', error);
      return NextResponse.json({ error: 'Analytics laden mislukt' }, { status: 500 });
    }

    // Check if user has an active bank connection
    const { count } = await supabase
      .from('bank_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'linked');

    const hasBankConnection = (count || 0) > 0;

    return NextResponse.json({
      ...(data || {}),
      has_bank_connection: hasBankConnection,
      // Map monthly_trends as monthly_totals for the entry card
      monthly_totals: data?.monthly_trends || [],
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
