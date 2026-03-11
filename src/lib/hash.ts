// Bill dedup hash: SHA-256 of normalized vendor + amount + reference, sliced to 16 chars

export async function computeBillHash(
  vendor: string,
  amountCents: number,
  reference: string | null
): Promise<string> {
  const normalizedVendor = vendor.toLowerCase().trim().replace(/\s+/g, ' ')
  const normalizedRef = (reference || '').toLowerCase().trim()
  const input = `${normalizedVendor}|${amountCents}|${normalizedRef}`

  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return hashHex.slice(0, 16)
}

// IBAN validation using MOD-97 algorithm
export function validateIBAN(iban: string): boolean {
  if (!iban) return false

  const cleaned = iban.replace(/\s/g, '').toUpperCase()
  if (cleaned.length < 5 || cleaned.length > 34) return false
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return false

  // Move first 4 chars to end
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4)

  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  let numStr = ''
  for (const char of rearranged) {
    if (char >= 'A' && char <= 'Z') {
      numStr += (char.charCodeAt(0) - 55).toString()
    } else {
      numStr += char
    }
  }

  // MOD-97 check (handle large numbers by processing in chunks)
  let remainder = 0
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numStr[i], 10)) % 97
  }

  return remainder === 1
}
