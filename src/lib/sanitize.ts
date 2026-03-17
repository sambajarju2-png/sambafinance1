/**
 * Input sanitization utilities.
 * Applied to all user inputs before database storage.
 *
 * SERVER + CLIENT safe.
 */

/**
 * Sanitize a text input — strips HTML tags, trims whitespace, limits length.
 */
export function sanitizeText(input: unknown, maxLength: number = 500): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[<>]/g, '')     // Remove remaining angle brackets
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize an IBAN — uppercase, only allowed chars.
 */
export function sanitizeIban(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) return null;

  // IBAN: only letters, digits, spaces
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
  return cleaned.length >= 5 ? cleaned : null;
}

/**
 * Sanitize an amount string — only digits, comma, dot.
 */
export function sanitizeAmount(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^0-9.,\s]/g, '').trim();
}

/**
 * Validate a date string is YYYY-MM-DD format.
 */
export function isValidDate(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  const match = input.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return false;
  const date = new Date(input + 'T00:00:00');
  return !isNaN(date.getTime());
}

/**
 * Validate an email address (basic check).
 */
export function isValidEmail(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}
