import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/auth/login', '/auth/signup', '/auth/callback', '/plasmic-host'];

// Routes where auth check happens in the page itself
const HYBRID_ROUTES = ['/'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isHybridRoute = HYBRID_ROUTES.includes(pathname);
  const isAuthOnlyRoute = pathname.startsWith('/onboarding');

  // App routes that require auth (starts with known prefixes)
  const APP_PREFIXES = ['/overzicht', '/betalingen', '/stats', '/cashflow', '/instellingen', '/scan', '/onboarding'];
  const isAppRoute = APP_PREFIXES.some((p) => pathname.startsWith(p));

  // Hybrid routes handle their own auth
  if (isHybridRoute) {
    return supabaseResponse;
  }

  // Public Plasmic CMS pages — any route not matched by app routes is a potential CMS page
  // Let it through without auth
  if (!isAppRoute && !isPublicRoute) {
    return supabaseResponse;
  }

  // Not logged in + app route → login
  if (!user && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Logged in + auth pages (login/signup) → dashboard
  if (user && (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/overzicht';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.json|sw\\.js|api/).*)',
  ],
};
