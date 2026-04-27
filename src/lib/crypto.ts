// src/lib/crypto.ts — PW-01: AES-256-GCM envelope encryption for OAuth tokens
// Requires TOKEN_ENCRYPTION_KEY in Vercel env: openssl rand -hex 32
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const KEY_HEX = process.env.TOKEN_ENCRYPTION_KEY;

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(KEY_HEX, 'hex');
}

/**
 * Encrypt a plaintext token. Returns "iv.tag.ciphertext" (hex-encoded).
 */
export function encryptToken(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join('.');
}

/**
 * Decrypt a token previously encrypted with encryptToken().
 */
export function decryptToken(cipherText: string): string {
  const key = getKey();
  const parts = cipherText.split('.');
  if (parts.length !== 3) {
    // Not encrypted (legacy plain text) — return as-is for migration period
    return cipherText;
  }
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const dec = createDecipheriv('aes-256-gcm', key, iv);
  dec.setAuthTag(tag);
  return dec.update(enc).toString('utf8') + dec.final('utf8');
}

/**
 * Check if a value looks like it's already encrypted (has the iv.tag.ciphertext format)
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}
