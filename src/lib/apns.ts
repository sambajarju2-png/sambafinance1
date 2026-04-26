/**
 * Apple Push Notification service (APNs) sender
 * 
 * Uses HTTP/2 (required by APNs — fetch/HTTP1.1 will NOT work).
 * JWT auth via jose (ES256).
 * 
 * Required env vars:
 *   APNS_KEY_ID   — Key ID from Apple Developer portal
 *   APNS_TEAM_ID  — Your Apple Developer Team ID
 *   APNS_KEY_P8   — Contents of the .p8 auth key file
 *   APNS_SANDBOX  — 'true' for development builds, omit for production
 */

import * as http2 from 'http2';
import * as jose from 'jose';

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

export type ApnsResult =
  | { ok: true }
  | { ok: false; unregistered: true }
  | { ok: false; unregistered: false; status: number; reason: string };

interface ApnsPayload {
  title: string;
  body: string;
  url?: string;
  badge?: number;
}

/**
 * Send a push notification to an iOS device via APNs HTTP/2.
 * 
 * IMPORTANT: APNs requires HTTP/2. Node's fetch() only does HTTP/1.1,
 * which causes "Response does not match the HTTP/1.1 protocol" errors.
 * We MUST use the http2 module.
 */
export async function sendApnsPush(
  deviceToken: string,
  payload: ApnsPayload,
  sandbox = false
): Promise<ApnsResult> {
  const host = sandbox
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';

  const body = JSON.stringify({
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
  });

  let jwt: string;
  try {
    jwt = await getApnsJwt();
  } catch (err) {
    console.error('[APNs] JWT error:', err);
    return { ok: false, unregistered: false, status: 0, reason: 'JWT generation failed' };
  }

  return new Promise((resolve) => {
    let settled = false;

    const client = http2.connect(host);

    client.on('error', (err) => {
      if (settled) return;
      settled = true;
      console.error('[APNs] http2 connect error:', err);
      client.destroy();
      resolve({ ok: false, unregistered: false, status: 0, reason: err.message });
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${jwt}`,
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': '0',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body).toString(),
    });

    let statusCode = 0;
    req.on('response', (headers) => {
      statusCode = Number(headers[':status']);
    });

    let responseBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { responseBody += chunk; });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      client.close();

      if (statusCode === 200) {
        console.log('[APNs] Push sent successfully');
        resolve({ ok: true });
        return;
      }

      let reason = 'Unknown';
      try {
        const parsed = JSON.parse(responseBody);
        reason = parsed.reason ?? reason;
      } catch {
        reason = responseBody || 'empty response';
      }

      console.error(`[APNs] Push failed: ${statusCode} — ${reason}`);

      // 410 = device token no longer valid → caller should delete it
      if (statusCode === 410) {
        resolve({ ok: false, unregistered: true });
      } else {
        resolve({ ok: false, unregistered: false, status: statusCode, reason });
      }
    });

    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      client.destroy();
      console.error('[APNs] Request error:', err);
      resolve({ ok: false, unregistered: false, status: 0, reason: err.message });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Check if APNs is configured (env vars present).
 */
export function isApnsConfigured(): boolean {
  return !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY_P8);
}
