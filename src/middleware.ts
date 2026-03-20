import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

  // Root / is hybrid — page.tsx handles its own redirect
  if (pathname === '/') return supabaseResponse;

  // Auth callback always passes through
  if (pathname.startsWith('/auth/callback')) return supabaseResponse;

  // Logged-in user visiting login/signup → dashboard
  if (user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/overzicht';
    return NextResponse.redirect(url);
  }

  // Auth pages for anon users → pass through
  if (pathname.startsWith('/auth/')) return supabaseResponse;

  // App routes require auth
  const APP_PREFIXES = ['/overzicht', '/betalingen', '/stats', '/cashflow', '/instellingen', '/scan', '/onboarding', '/notifications'];
  const isAppRoute = APP_PREFIXES.some((p) => pathname.startsWith(p));

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
