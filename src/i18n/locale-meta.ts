// Client-safe locale constants + display metadata.
// NO server-only imports (no next/headers) so this can be imported by both
// server code (i18n/routing.ts) and client components (switchers).
//
// To add a language: add its code here, add a matching src/messages/<code>.json,
// and add a LOCALE_META entry. Everything else is data-driven.

export const LOCALES = ['nl', 'en', 'pl', 'tr', 'fr', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'nl';

export const LOCALE_META: Record<Locale, { label: string; flag: string }> = {
  nl: { label: 'Nederlands', flag: '🇳🇱' },
  en: { label: 'English', flag: '🇬🇧' },
  pl: { label: 'Polski', flag: '🇵🇱' },
  tr: { label: 'Türkçe', flag: '🇹🇷' },
  fr: { label: 'Français', flag: '🇫🇷' },
  ar: { label: 'العربية', flag: '🇸🇦' },
};

// Narrowing helper: is an arbitrary string one of our supported locales?
export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
