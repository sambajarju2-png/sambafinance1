/**
 * Language helpers for AI prompts.
 *
 * Two distinct concepts:
 * 1. The language the AI responds / explains in  -> matches the user's UI language.
 * 2. The language a creditor-facing letter is written in -> Dutch creditors read
 *    Dutch, so only English keeps its own letter; everyone else routes to Dutch.
 */

// Supported language codes (kept in sync with user_settings.language).
export const LANGUAGE_NAMES: Record<string, string> = {
  nl: 'Dutch',
  en: 'English',
  pl: 'Polish',
  tr: 'Turkish',
  ar: 'Arabic',
};

/**
 * Language the AI should respond / explain in (chat, insights, welcome message).
 * Falls back to Dutch for unknown / missing codes.
 */
export function languageName(code?: string | null): string {
  return LANGUAGE_NAMES[code ?? 'nl'] ?? 'Dutch';
}

/**
 * Language a draft letter to a creditor must be written in.
 * nl -> Dutch, en -> English, pl/tr/ar -> Dutch (the deurwaarder/incassobureau
 * reads Dutch). The explanation shown to the user around the letter is handled
 * separately and uses languageName().
 */
const LETTER_LANGUAGE: Record<string, string> = {
  nl: 'Dutch',
  en: 'English',
  pl: 'Dutch',
  tr: 'Dutch',
  ar: 'Dutch',
};

export function letterLanguageName(code?: string | null): string {
  return LETTER_LANGUAGE[code ?? 'nl'] ?? 'Dutch';
}
