// src/lib/verify-cron.ts — PW-15: Timing-safe cron secret verification
import { timingSafeEqual } from 'crypto';

/**
 * Verify that a request comes from Vercel Cron or an authorized caller.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyCronSecret(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const token = auth?.replace('Bearer ', '').trim();

  if (!token || !process.env.CRON_SECRET) return false;

  try {
    const a = Buffer.from(token, 'utf8');
    const b = Buffer.from(process.env.CRON_SECRET, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
