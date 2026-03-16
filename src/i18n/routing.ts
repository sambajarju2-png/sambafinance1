import { cookies } from 'next/headers';

// PayWatch uses cookie-based locale (user chooses in onboarding/settings)
// NOT URL-based routing (/nl/... /en/...)
// Default is Dutch (nl) since this is a Dutch-market app

export const LOCALES = ['nl', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'nl';

const COOKIE_NAME = 'paywatch-locale';

export async function getUserLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(COOKIE_NAME)?.value;

  if (stored && LOCALES.includes(stored as Locale)) {
    return stored as Locale;
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
