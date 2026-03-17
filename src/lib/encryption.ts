import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const VERSION = 'v1';

/**
 * Get the encryption key from environment.
 * Must be a 32-byte base64-encoded string.
 * Generate with: openssl rand -base64 32
 */
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
  }
  return buf;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns format: "v1:iv_base64:ciphertext_base64:authTag_base64"
 *
 * Each call generates a unique IV, so the same plaintext
 * produces different ciphertext every time.
 *
 * SERVER-ONLY — never import in client components.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    encrypted,
    authTag.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a ciphertext string using AES-256-GCM.
 * Expects format: "v1:iv_base64:ciphertext_base64:authTag_base64"
 *
 * SERVER-ONLY — never import in client components.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Invalid encrypted data format');
  }

  const [, ivBase64, encryptedBase64, authTagBase64] = parts;

  const key = getKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
