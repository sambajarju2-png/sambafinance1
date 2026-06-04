import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Supabase session refresh proxy (Next.js 16 — previously "middleware").
 *
 * This is REQUIRED by @supabase/ssr. Without it, JWTs expire after ~1 hour
 * and ALL server-side auth checks (getUser, getAuthUserId) return null → 401.
 *
 * PERF: the previous version called supabase.auth.getUser() — a network round
 * trip to Supabase Auth — on EVERY request. That validates the token but the
 * proxy never used the result; its only job is to REFRESH the token before it
 * expires. So we now read the session expiry locally from the cookie and only
 * make the network call when the token is missing or close to expiring. The
 * refresh guarantee is unchanged (getUser is still the refresh trigger, fired
 * within 120s of expiry), and on ANY parsing uncertainty we fall back to the
 * old always-refresh behaviour — so there is no auth regression.
 *
 * DO NOT add business logic here. Just refresh the session and pass through.
 */

const PROJECT_REF = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
  } catch {
    return '';
  }
})();

/**
 * Read the stored session's expiry (unix seconds) from the Supabase auth
 * cookie WITHOUT a network call. Returns null if it can't be determined for
 * any reason — callers must treat null as "refresh needed".
 */
function readSessionExpiry(request: NextRequest): number | null {
  try {
    if (!PROJECT_REF) return null;
    const base = `sb-${PROJECT_REF}-auth-token`;

    // The cookie is a single value, or chunked across `.0`, `.1`, ... cookies.
    let raw = request.cookies.get(base)?.value;
    if (!raw) {
      const chunks: string[] = [];
      for (let i = 0; i < 10; i++) {
        const part = request.cookies.get(`${base}.${i}`)?.value;
        if (!part) break;
        chunks.push(part);
      }
      if (chunks.length === 0) return null;
      raw = chunks.join('');
    }

    // @supabase/ssr stores the value base64URL-encoded with a `base64-`
    // prefix. Convert base64URL -> base64 before decoding.
    if (raw.startsWith('base64-')) {
      const b64 = raw.slice('base64-'.length).replace(/-/g, '+').replace(/_/g, '/');
      raw = Buffer.from(b64, 'base64').toString('utf-8');
    }

    const session = JSON.parse(raw);

    // Preferred: the session object carries expires_at (unix seconds).
    if (typeof session?.expires_at === 'number') return session.expires_at;

    // Fallback: decode the access_token JWT and read its `exp` claim.
    const token: unknown = session?.access_token;
    if (typeof token === 'string') {
      const payloadPart = token.split('.')[1];
      if (payloadPart) {
        const payload = JSON.parse(
          Buffer.from(
            payloadPart.replace(/-/g, '+').replace(/_/g, '/'),
            'base64'
          ).toString('utf-8')
        );
        if (typeof payload?.exp === 'number') return payload.exp;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Fast path: if the token is comfortably valid (>120s left), no refresh is
  // needed, so skip the network round-trip entirely. Any uncertainty (null)
  // falls through to the full refresh below.
  const expiry = readSessionExpiry(request);
  if (expiry !== null) {
    const now = Math.floor(Date.now() / 1000);
    if (expiry - now > 120) {
      return supabaseResponse;
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies back to the request (so downstream code sees them)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Re-create the response so we can write cookies to the browser
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT add any code between createServerClient and getUser().
  // A simple mistake here will break session refresh.
  // This call silently refreshes the token if it has expired.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api (route handlers create their own Supabase client and refresh the
     *   session themselves; the browser client also keeps cookies fresh)
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public assets (images, fonts, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
