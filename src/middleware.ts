import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Initialize next-intl middleware
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Run next-intl middleware first
  const response = intlMiddleware(request);

  // 2. Setup Supabase
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Note: we apply cookie changes to the 'response' object from intlMiddleware
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Root / is hybrid
  if (pathname === '/') return response;

  // Auth callback
  if (pathname.startsWith('/auth/callback')) return response;

  // Redirect logged-in users away from login
  if (user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/overzicht';
    return NextResponse.redirect(url);
  }

  // Auth pages for anon users
  if (pathname.startsWith('/auth/')) return response;

  // App routes require auth
  const APP_PREFIXES = ['/overzicht', '/betalingen', '/stats', '/cashflow', '/instellingen', '/scan', '/onboarding'];
  const isAppRoute = APP_PREFIXES.some((p) => pathname.startsWith(p));

  if (isAppRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Matcher for both next-intl and supabase
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|auth/callback).*)']
};
