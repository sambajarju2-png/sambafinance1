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
