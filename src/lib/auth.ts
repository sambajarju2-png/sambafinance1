import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

async function createRequestScopedClient() {
  const cookieStore = await cookies();
  return createServerClient(
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
            // Called from a Server Component (can't set cookies) — safe to ignore.
            // Token refresh still works inside Route Handlers, where setAll succeeds.
          }
        },
      },
    }
  );
}

/**
 * Get the authenticated user's ID from a server component or API route.
 * Returns null if not authenticated.
 *
 * PERF: the hot path uses getClaims(), which (with this project's asymmetric
 * ES256 signing keys) verifies the access-token JWT LOCALLY via the cached
 * JWKS — sub-millisecond, no round-trip to Supabase Auth. This replaces a
 * per-route network getUser() call that was adding ~100-300ms (London→Ireland)
 * to every one of the ~108 authed routes.
 *
 * Only when the local check fails (e.g. the access token has expired) do we
 * fall back to getUser(), which refreshes the session via the refresh token
 * and persists the rotated cookies. That network cost is now paid at most once
 * per user per token lifetime instead of on every request.
 *
 * Usage in server components:  const userId = await getAuthUserId();
 * Usage in API routes:         const userId = await getAuthUserId(req);
 */
export async function getAuthUserId(_req?: NextRequest): Promise<string | null> {
  try {
    const supabase = await createRequestScopedClient();

    // Fast path: local JWT verification (no network with asymmetric keys).
    const { data: claimsData } = await supabase.auth.getClaims();
    const sub = claimsData?.claims?.sub;
    if (sub) return sub as string;

    // Slow path: token expired/invalid locally → refresh + validate via Auth.
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Like getAuthUserId, but ALWAYS makes a network call to Supabase Auth
 * (getUser) so server-side session revocation / logout is detected immediately
 * rather than after the JWT expires. Slower (~1 round-trip). Use ONLY on
 * destructive / high-sensitivity routes: account deletion, GDPR export/erase,
 * plan / billing changes, admin actions. Everywhere else use getAuthUserId.
 */
export async function getAuthUserIdVerified(_req?: NextRequest): Promise<string | null> {
  try {
    const supabase = await createRequestScopedClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
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
