import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

/**
 * Get the authenticated user's ID from a server component or API route.
 * Returns null if not authenticated.
 *
 * Usage in server components:
 *   const userId = await getAuthUserId();
 *
 * Usage in API routes:
 *   const userId = await getAuthUserId(req);
 */
export async function getAuthUserId(req?: NextRequest): Promise<string | null> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Called from Server Component — safe to ignore
            }
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch {
    return null;
  }
}

/** No-cache headers — used on every API response */
export const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
} as const;

// Use for GET endpoints that return user-specific data (bills, analytics, settings).
// Allows the browser to serve cached data for 10s, then refresh in background for 30s.
// Safe because: private (no CDN caching), user-specific (behind auth), 10s staleness is fine.
export const SHORT_CACHE = {
  'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
} as const;

/**
 * Check if a user's account is restricted (GDPR "beperking").
 * When restricted, data processing (email scan, bank sync, AI) should be blocked.
 */
export async function isAccountRestricted(userId: string): Promise<boolean> {
  try {
    const { createServiceRoleClient } = require('@/lib/supabase/server');
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('user_settings')
      .select('is_restricted')
      .eq('user_id', userId)
      .single();
    return data?.is_restricted === true;
  } catch {
    return false;
  }
}
