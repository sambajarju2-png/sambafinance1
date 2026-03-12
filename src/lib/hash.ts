export async function computeBillHash(vendor: string, amountCents: number, reference: string | null): Promise<string> {
  const normalizedVendor = vendor.toLowerCase().trim().replace(/\s+/g, ' ')
  const normalizedRef = (reference || '').toLowerCase().trim()
  const input = `${normalizedVendor}|${amountCents}|${normalizedRef}`
  const encoder = new TextEncoder(); const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}
export function validateIBAN(iban: string): boolean {
  if (!iban) return false
  const cleaned = iban.replace(/\s/g, '').toUpperCase()
  if (cleaned.length < 5 || cleaned.length > 34) return false
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return false
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4)
  let numStr = ''
  for (const char of rearranged) {
    if (char >= 'A' && char <= 'Z') numStr += (char.charCodeAt(0) - 55).toString()
    else numStr += char
  }
  let remainder = 0
  for (let i = 0; i < numStr.length; i++) remainder = (remainder * 10 + parseInt(numStr[i], 10)) % 97
  return remainder === 1
}
