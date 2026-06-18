import { cookies } from 'next/headers';
import { LOCALES, DEFAULT_LOCALE, isLocale, type Locale } from './locale-meta';

// PayWatch uses cookie-based locale (user chooses in onboarding/settings)
// NOT URL-based routing (/nl/... /en/...)
// Default is Dutch (nl) since this is a Dutch-market app.
// The locale list + display metadata live in ./locale-meta (client-safe, no
// next/headers) so client switchers can import them. Re-exported here so any
// existing imports from './routing' keep working unchanged.
export { LOCALES, DEFAULT_LOCALE };
export type { Locale };

const COOKIE_NAME = 'paywatch-locale';

export async function getUserLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(COOKIE_NAME)?.value;

  if (isLocale(stored)) {
    return stored;
  }

  return DEFAULT_LOCALE;
}

export async function setUserLocale(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
