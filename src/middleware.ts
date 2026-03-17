import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/auth/login', '/auth/signup', '/auth/callback', '/plasmic-host', '/cms'];

const HYBRID_ROUTES = ['/'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isHybridRoute = HYBRID_ROUTES.includes(pathname);

  // App routes that require auth
  const APP_PREFIXES = ['/overzicht', '/betalingen', '/stats', '/cashflow', '/instellingen', '/scan', '/onboarding'];
  const isAppRoute = APP_PREFIXES.some((p) => pathname.startsWith(p));

  // Hybrid routes (landing page) handle their own auth
  if (isHybridRoute) return supabaseResponse;

  // Public routes (auth pages, plasmic, cms) pass through
  if (isPublicRoute) {
    // But redirect logged-in users away from login/signup
    if (user && (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup'))) {
      const url = request.nextUrl.clone();
      url.pathname = '/overzicht';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // App routes require auth
  if (isAppRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.json|sw\\.js|api/).*)',
  ],
};
