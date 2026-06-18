import { isLocale, type Locale } from '@/i18n/locale-meta';

/**
 * Read the active UI locale from the paywatch-locale cookie (client-side only).
 * Falls back to 'nl' when unavailable or unrecognized.
 *
 * Use this in components that don't already receive a `lang` prop and that
 * historically read the cookie with a hardcoded /(nl|en)/ regex.
 */
export function localeFromCookie(): Locale {
  if (typeof document === 'undefined') return 'nl';
  const code = document.cookie.match(/paywatch-locale=([a-z]{2})/)?.[1];
  return isLocale(code) ? (code as Locale) : 'nl';
}

/**
 * Pick a localized value for the given locale.
 * pl/tr/fr/ar are optional and fall back to en, then nl, so a partially-translated
 * dictionary can never render `undefined` or crash.
 */
export function pick<T>(lang: string, o: { nl: T; en: T; pl?: T; tr?: T; fr?: T; ar?: T }): T {
  if (lang === 'en') return o.en;
  if (lang === 'pl') return o.pl ?? o.en;
  if (lang === 'tr') return o.tr ?? o.en;
  if (lang === 'fr') return o.fr ?? o.en;
  if (lang === 'ar') return o.ar ?? o.en;
  return o.nl;
}
