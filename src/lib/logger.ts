// src/lib/logger.ts — PW-07: Structured logger with PII redaction
// Replaces console.log throughout the app to prevent token/IBAN leaks to Vercel logs

const REDACT_KEYS = [
  'refresh_token', 'access_token', 'id_token', 'token',
  'iban', 'creditor_iban', 'debtor_iban',
  'email', 'raw_data', 'password', 'secret',
  'agreement_id', 'session_id', 'authorization',
  'api_key', 'apikey', 'private_key',
];

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 4) return '[DEEP]';
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object' || obj === null) return obj;
  if (obj instanceof Error) return { message: obj.message, name: obj.name };
  if (Array.isArray(obj)) return obj.slice(0, 10).map(item => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      REDACT_KEYS.some(r => k.toLowerCase().includes(r))
        ? '[REDACTED]'
        : redact(v, depth + 1),
    ])
  );
}

export const log = {
  info:  (msg: string, ctx?: object) => console.info( `[INFO]  ${msg}`, ctx ? redact(ctx) : ''),
  warn:  (msg: string, ctx?: object) => console.warn( `[WARN]  ${msg}`, ctx ? redact(ctx) : ''),
  error: (msg: string, ctx?: object) => console.error(`[ERROR] ${msg}`, ctx ? redact(ctx) : ''),
};
