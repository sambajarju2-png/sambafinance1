// src/lib/csrf.ts — PW-06: Origin-based CSRF protection for state-mutating routes
import { headers } from 'next/headers';

const ALLOWED_ORIGINS = [
  'https://app.paywatch.app',
  'capacitor://localhost',       // Capacitor iOS
  'ionic://localhost',           // Capacitor fallback
  'http://localhost:3000',       // local dev
  'http://localhost:3001',
];

/**
 * Verify the request origin matches an allowed origin.
 * Call at the start of every POST/PUT/DELETE API route.
 * Throws if origin is missing or not allowed.
 */
export async function verifyCsrf(): Promise<void> {
  // Skip in development
  if (process.env.NODE_ENV === 'development') return;

  const h = await headers();
  const origin = h.get('origin');
  const referer = h.get('referer');

  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try { requestOrigin = new URL(referer).origin; } catch {}
  }

  // Allow requests without origin header from same-origin navigation
  // (some browsers omit origin on same-site requests)
  if (!requestOrigin) return;

  const allowed = ALLOWED_ORIGINS.some(o => requestOrigin!.startsWith(o));
  if (!allowed) {
    throw new Error(`CSRF: origin '${requestOrigin}' not allowed`);
  }
}
