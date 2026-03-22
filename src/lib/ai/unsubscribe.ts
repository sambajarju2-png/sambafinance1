/**
 * Generate a signed unsubscribe URL for the weekly digest email.
 *
 * Usage:
 *   import { generateUnsubscribeUrl } from '@/lib/unsubscribe';
 *   const url = generateUnsubscribeUrl(userId, 'nl');
 */

import { createHmac } from "crypto";

export function generateUnsubscribeUrl(
  userId: string,
  lang: "nl" | "en" = "nl"
): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  const token = createHmac("sha256", secret)
    .update(userId)
    .digest("base64url");

  return `https://paywatch.app/unsubscribe?uid=${userId}&token=${token}&lang=${lang}`;
}
