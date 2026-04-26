/**
 * Apple Push Notification service (APNs) sender
 * 
 * Uses JWT-based authentication with HTTP/2.
 * Required env vars:
 *   APNS_KEY_ID   — Key ID from Apple Developer portal
 *   APNS_TEAM_ID  — Your Apple Developer Team ID
 *   APNS_KEY_P8   — Contents of the .p8 auth key file
 * 
 * Setup instructions:
 *   1. Go to https://developer.apple.com/account/resources/authkeys/list
 *   2. Create a new key → Enable "Apple Push Notifications service (APNs)"
 *   3. Download the .p8 file
 *   4. Copy Key ID, Team ID, and file contents to Vercel env vars
 *   5. For APNS_KEY_P8, paste the full contents including BEGIN/END PRIVATE KEY lines
 */

import * as jose from 'jose';

const APNS_PROD_HOST = 'https://api.push.apple.com';
const APNS_DEV_HOST = 'https://api.sandbox.push.apple.com';
const BUNDLE_ID = 'nl.paywatch.app';

let cachedToken: { jwt: string; expiresAt: number } | null = null;

/**
 * Generate a JWT for APNs authentication.
 * Cached for 50 minutes (APNs tokens last 60 min).
 */
async function getApnsJwt(): Promise<string> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyP8 = process.env.APNS_KEY_P8;

  if (!keyId || !teamId || !keyP8) {
    throw new Error('APNs not configured: missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_KEY_P8');
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.jwt;
  }

  const privateKey = await jose.importPKCS8(keyP8, 'ES256');

  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .sign(privateKey);

  cachedToken = { jwt, expiresAt: now + 50 * 60 };
  return jwt;
}

interface ApnsPayload {
  title: string;
  body: string;
  url?: string;
  badge?: number;
}

/**
 * Send a push notification to an iOS device via APNs.
 * Returns true if successful, false if failed (e.g. invalid token).
 */
export async function sendApnsPush(
  deviceToken: string,
  payload: ApnsPayload,
  sandbox = false
): Promise<boolean> {
  try {
    const jwt = await getApnsJwt();
    const host = sandbox ? APNS_DEV_HOST : APNS_PROD_HOST;

    const apnsPayload = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: 'default',
        badge: payload.badge ?? 1,
        'mutable-content': 1,
      },
      url: payload.url || '/overzicht',
    };

    const response = await fetch(`${host}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic': BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
        'content-type': 'application/json',
      },
      body: JSON.stringify(apnsPayload),
    });

    if (response.ok) {
      return true;
    }

    const errorBody = await response.text();
    console.error(`[APNs] Failed (${response.status}):`, errorBody);

    // 410 Gone = token no longer valid
    if (response.status === 410 || response.status === 400) {
      return false; // Signal to remove this token
    }

    return false;
  } catch (err) {
    console.error('[APNs] Send error:', err);
    return false;
  }
}

/**
 * Check if APNs is configured (env vars present).
 */
export function isApnsConfigured(): boolean {
  return !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY_P8);
}
