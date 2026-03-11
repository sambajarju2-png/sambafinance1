// AES-256-GCM encryption for OAuth tokens stored in gmail_accounts table
// Uses ENCRYPTION_KEY env var

const ALGO = 'AES-GCM'

async function getKey(): Promise<CryptoKey> {
  const keyStr = process.env.ENCRYPTION_KEY
  if (!keyStr) throw new Error('Missing ENCRYPTION_KEY')

  // Derive a 256-bit key from the base64 secret
  const rawKey = Uint8Array.from(atob(keyStr), (c) => c.charCodeAt(0))
  const hashBuffer = await crypto.subtle.digest('SHA-256', rawKey)

  return crypto.subtle.importKey('raw', hashBuffer, ALGO, false, ['encrypt', 'decrypt'])
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded
  )

  // Concatenate iv + ciphertext, encode as base64
  const cipherArray = new Uint8Array(cipherBuffer)
  const combined = new Uint8Array(iv.length + cipherArray.length)
  combined.set(iv)
  combined.set(cipherArray, iv.length)

  // Convert to base64
  let binary = ''
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i])
  }
  return btoa(binary)
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = await getKey()
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))

  const iv = combined.slice(0, 12)
  const data = combined.slice(12)

  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    data
  )

  return new TextDecoder().decode(plainBuffer)
}
