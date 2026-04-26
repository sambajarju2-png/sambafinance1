import { NextResponse } from 'next/server';
import * as http2 from 'http2';
import * as jose from 'jose';

const NO_CACHE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/push/debug
 * Diagnoses APNs configuration and attempts a test push with detailed logging.
 */
export async function POST() {
  return runDebug();
}

export async function GET() {
  return runDebug();
}

async function runDebug() {
  // Temporary debug — get first user's token
  const { createServiceRoleClient } = await import('@/lib/supabase/server');
  const supabase = createServiceRoleClient();

  const keyId = process.env.APNS_KEY_ID || '';
  const teamId = process.env.APNS_TEAM_ID || '';
  const keyP8 = process.env.APNS_KEY_P8 || '';
  const sandbox = process.env.APNS_SANDBOX === 'true';

  const debug: Record<string, unknown> = {
    step: 'init',
    keyId_set: !!keyId,
    keyId_value: keyId,
    teamId_set: !!teamId,
    teamId_value: teamId,
    keyP8_set: !!keyP8,
    keyP8_length: keyP8.length,
    keyP8_starts: keyP8.substring(0, 30),
    keyP8_ends: keyP8.substring(keyP8.length - 30),
    keyP8_has_begin: keyP8.includes('-----BEGIN'),
    keyP8_has_end: keyP8.includes('-----END'),
    keyP8_newlines: (keyP8.match(/\n/g) || []).length,
    sandbox,
    bundleId: 'nl.paywatch.app',
  };

  // Step 1: Try to parse the private key
  try {
    const privateKey = await jose.importPKCS8(keyP8, 'ES256');
    debug.step = 'key_parsed';
    debug.key_parsed = true;
    debug.key_type = privateKey.type;
  } catch (err: unknown) {
    debug.key_parsed = false;
    debug.key_error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ debug }, { headers: NO_CACHE });
  }

  // Step 2: Try to generate JWT
  let jwt: string;
  try {
    const privateKey = await jose.importPKCS8(keyP8, 'ES256');
    const now = Math.floor(Date.now() / 1000);
    jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .sign(privateKey);
    debug.step = 'jwt_generated';
    debug.jwt_generated = true;
    debug.jwt_length = jwt.length;
    debug.jwt_preview = jwt.substring(0, 50) + '...';
  } catch (err: unknown) {
    debug.jwt_generated = false;
    debug.jwt_error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ debug }, { headers: NO_CACHE });
  }

  // Step 3: Try to connect to APNs and send a test push
  const { createServerSupabaseClient } = await import('@/lib/supabase/server');
  const supabase = await createServerSupabaseClient();
  const { data: tokens } = await supabase
    .from('native_push_tokens')
    .select('token')
    .eq('platform', 'ios')
    .limit(1);

  if (!tokens || tokens.length === 0) {
    debug.step = 'no_tokens';
    return NextResponse.json({ debug }, { headers: NO_CACHE });
  }

  const deviceToken = tokens[0].token;
  debug.token_length = deviceToken.length;
  debug.token_preview = deviceToken.substring(0, 20) + '...';

  const host = sandbox
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';
  debug.apns_host = host;

  const body = JSON.stringify({
    aps: {
      alert: { title: 'Debug Test', body: 'APNs debug push' },
      sound: 'default',
      badge: 1,
    },
  });

  return new Promise<NextResponse>((resolve) => {
    const client = http2.connect(host);

    client.on('error', (err) => {
      debug.step = 'connect_error';
      debug.connect_error = err.message;
      client.destroy();
      resolve(NextResponse.json({ debug }, { headers: NO_CACHE }));
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${jwt}`,
      'apns-topic': 'nl.paywatch.app',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body).toString(),
    });

    let statusCode = 0;
    req.on('response', (headers) => {
      statusCode = Number(headers[':status']);
      debug.apns_status = statusCode;
    });

    let responseBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { responseBody += chunk; });

    req.on('end', () => {
      client.close();
      debug.step = statusCode === 200 ? 'success' : 'apns_error';
      debug.apns_response = responseBody || '(empty — means success)';
      try {
        debug.apns_parsed = JSON.parse(responseBody);
      } catch {}
      resolve(NextResponse.json({ debug }, { headers: NO_CACHE }));
    });

    req.on('error', (err) => {
      client.destroy();
      debug.step = 'request_error';
      debug.request_error = err.message;
      resolve(NextResponse.json({ debug }, { headers: NO_CACHE }));
    });

    req.write(body);
    req.end();
  });
}
