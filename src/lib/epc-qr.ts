/**
 * EPC QR Code Parser
 * Parses European Payment Council (EPC) QR codes used on Dutch invoices.
 *
 * EPC QR Format (newline-separated):
 * Line 1: Service Tag ("BCD")
 * Line 2: Version ("001" or "002")
 * Line 3: Character set (1 = UTF-8)
 * Line 4: Identification ("SCT" = SEPA Credit Transfer)
 * Line 5: BIC of beneficiary bank
 * Line 6: Beneficiary name (vendor)
 * Line 7: IBAN
 * Line 8: Amount (e.g. "EUR127.50")
 * Line 9: Purpose code (optional, 4 chars)
 * Line 10: Structured reference (e.g. RF...)
 * Line 11: Unstructured remittance text
 * Line 12: Beneficiary to originator info
 */

export interface EPCPaymentData {
  vendor: string;
  iban: string;
  bic: string;
  amount_cents: number;
  currency: string;
  reference: string | null;
  description: string | null;
}

/**
 * Check if a QR code string is an EPC payment QR
 */
export function isEPCQR(data: string): boolean {
  const lines = data.split('\n');
  return lines.length >= 4 && lines[0].trim() === 'BCD' && lines[3].trim() === 'SCT';
}

/**
 * Parse EPC QR code data into structured payment info
 */
export function parseEPCQR(data: string): EPCPaymentData | null {
  const lines = data.split('\n').map((l) => l.trim());

  if (lines.length < 7) return null;
  if (lines[0] !== 'BCD') return null;
  if (lines[3] !== 'SCT') return null;

  const bic = lines[4] || '';
  const vendor = lines[5] || '';
  const iban = lines[6] || '';

  // Parse amount: "EUR127.50" or "EUR12.5"
  let amount_cents = 0;
  let currency = 'EUR';
  if (lines[7]) {
    const amountStr = lines[7];
    const match = amountStr.match(/^([A-Z]{3})(\d+(?:\.\d{1,2})?)$/);
    if (match) {
      currency = match[1];
      amount_cents = Math.round(parseFloat(match[2]) * 100);
    }
  }

  // Reference: prefer structured (line 10), fall back to unstructured (line 11)
  const structuredRef = lines[9] || null;
  const unstructuredRef = lines[10] || null;
  const reference = structuredRef || unstructuredRef;

  // Description from unstructured remittance or beneficiary info
  const description = unstructuredRef || lines[11] || null;

  if (!vendor && !iban) return null;

  return {
    vendor,
    iban,
    bic,
    amount_cents,
    currency,
    reference,
    description,
  };
}

/**
 * Try to parse any QR code — returns structured data if it's a payment QR,
 * or null if it's not recognized.
 * Also handles iDEAL QR codes (URLs starting with https://qr.ideal.nl/)
 */
export function parsePaymentQR(data: string): EPCPaymentData | null {
  // Try EPC format first
  if (isEPCQR(data)) {
    return parseEPCQR(data);
  }

  // Try iDEAL URL format (https://qr.ideal.nl/...)
  if (data.startsWith('https://qr.ideal.nl/') || data.startsWith('https://betaalverzoek.rabobank.nl/')) {
    // These are payment URLs — we can't parse them but we can store them
    return {
      vendor: '',
      iban: '',
      bic: '',
      amount_cents: 0,
      currency: 'EUR',
      reference: null,
      description: data, // Store the URL as description
    };
  }

  return null;
}
