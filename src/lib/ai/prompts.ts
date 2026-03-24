/**
 * PayWatch AI Extraction Prompt Builder
 * 
 * Builds the system prompt for Gemini Flash with:
 * 1. Base extraction instructions
 * 2. Dutch-specific invoice rules
 * 3. Dynamic correction patterns from user feedback
 */

const DUTCH_INVOICE_RULES = `
CRITICAL DUTCH INVOICE EXTRACTION RULES:

=== AMOUNTS ===
- "Te betalen", "Totaal te betalen", or "Nog te betalen" is ALWAYS the correct total amount. Use this.
- "Bedrag boete", "Bedrag factuur", "Subtotaal", or "Bedrag exclusief" is the BASE amount WITHOUT fees — do NOT use this as the final amount.
- If "Administratiekosten", "Incassokosten", "Buitengerechtelijke kosten", or "Rente" are listed, the correct amount INCLUDES these fees.
- When a "betalingsregeling" (payment plan) shows multiple terms/termijnen with dates:
  → amount = the "NOG TE BETALEN" amount (current installment), NOT the total debt
  → due_date = the first Vervaldatum that is in the FUTURE (after today)
- Dutch format: €1.234,56 means one thousand two hundred thirty four euros and fifty six cents = 123456 cents
- Remove dots as thousand separators, use comma as decimal: "€ 1.280,00" = 128000 cents

=== IBAN SELECTION ===
- Use the IBAN explicitly labeled under "Betaalinformatie", "Betalen op bankrekening", "Rekeningnummer", or "Overmaken naar"
- IGNORE IBANs in: headers, footers, legal disclaimers, "uw eigen rekening" (that's the customer's IBAN), or "t.n.v." sections that reference the customer
- If "t.a.v." or "ter attentie van" appears near an IBAN, that IS the correct payment IBAN
- Dutch IBANs: NL followed by 2 digits, then 4 letters (bank code: INGB, ABNA, RABO, KNAB, TRIO, BUNQ), then 10 digits
- If multiple IBANs appear, prefer the one nearest to "Te betalen" or in a QR code section

=== VENDOR NAME ===
- If the document is from an incasso/collection agency with an "Opdrachtgever" (client):
  → vendor = "[Incassobureau] (namens [Opdrachtgever])"
  → Example: "Coeo Incasso (namens Coolblue)" or "Flanderijn (namens Ziggo)"
- For government: use the exact entity name: "CJIB", "Belastingdienst", "Gemeente [naam]"
- Use the SENDER of the invoice, not the payment processor

=== REFERENCE NUMBER ===
- "Betalingskenmerk" = structured payment reference (often 16 digits) — PREFERRED
- "Dossiernummer" or "Zaaknummer" = case number (use if no betalingskenmerk)
- "Factuurnummer" = invoice number
- "Klantnummer" = customer number — do NOT use as reference (it's not payment-specific)
- If multiple references exist, prefer "Betalingskenmerk" > "Dossiernummer" > "Factuurnummer"

=== DUE DATE ===
- "Vervaldatum", "Betaal voor", "Uiterlijk betalen voor", "Betaaltermijn" = due date
- If a "betalingsregeling" shows multiple dates, use the first date that is AFTER today's date
- "Verzenddatum", "Factuurdatum", "Datum" = document date — NOT the due date
- If no explicit due date, return null — do NOT guess
- Format: always return as YYYY-MM-DD

=== CATEGORY ===
Must be exactly one of: wonen, nutsvoorzieningen, zorg, verzekeringen, telecom, overheid, vervoer, leningen, winkels, abonnementen, gezin, zakelijk, incasso, overig

Category rules:
- CJIB, verkeersboete, Wahv, Mulder → "overheid"
- Belastingdienst, inkomstenbelasting, BTW, toeslagen → "overheid"
- Gemeente, waterschap, gemeentebelasting, rioolheffing → "overheid"
- DUO, studieschuld → "overheid"
- Incassobureau, deurwaarder, Flanderijn, Coeo, Syncasso, GGN, Intrum → "incasso"
- Ziggo, KPN, T-Mobile, Odido, Vodafone, Tele2, Youfone → "telecom"
- Eneco, Vattenfall, Essent, Greenchoice, Budget Energie, Oxxio → "nutsvoorzieningen"
- Vitens, Waternet, Brabant Water, PWN, Evides → "nutsvoorzieningen"
- Zilveren Kruis, VGZ, CZ, Menzis, Unive, ONVZ, DSW → "zorg"
- Centraal Beheer, Interpolis, Nationale-Nederlanden, ASR, FBTO → "verzekeringen"
- Netflix, Spotify, Disney+, HBO, Amazon Prime → "abonnementen"
- Huur, hypotheek, woningcorporatie, Vestia, Woonbron → "wonen"
- NS, OV-chipkaart, RET, GVB, HTM → "vervoer"

=== ESCALATION STAGE ===
Must be exactly one of: factuur, herinnering, aanmaning, incasso, deurwaarder

Detection rules:
- "incasso", "incassobureau", "buitengerechtelijke", "dossier overgedragen" → "incasso"
- "deurwaarder", "gerechtelijk", "dagvaarding", "beslag", "exploot" → "deurwaarder"  
- "aanmaning", "laatste waarschuwing", "ingebrekestelling", "sommatie" → "aanmaning"
- "herinnering", "betalingsherinnering", "tweede verzoek" → "herinnering"
- Default (normal invoice) → "factuur"
`;

const ENGLISH_CONTEXT = `
NOTE: While the interface supports English, virtually all Dutch invoices/letters are in Dutch.
However, some international companies (e.g., Apple, Google, Amazon) send invoices in English.
Apply the same extraction logic regardless of language.
`;

/**
 * Build the complete extraction prompt for photo/image scanning.
 * @param correctionRules - Dynamic rules from user correction patterns (can be empty)
 */
export function buildExtractionPrompt(correctionRules: string = ''): string {
  return `You are an expert Dutch invoice/bill data extractor. Extract structured payment data from this image of a Dutch bill, invoice, fine, or letter.

${DUTCH_INVOICE_RULES}

${ENGLISH_CONTEXT}

${correctionRules}

TODAY'S DATE: ${new Date().toISOString().split('T')[0]}

Extract and return ONLY a JSON object with these exact fields:
{
  "vendor": "Company/organization name (string, required)",
  "amount_cents": 12345 (integer, amount in euro CENTS, required),
  "iban": "NL00XXXX0000000000" (string or null),
  "reference": "Payment reference/kenmerk" (string or null),
  "due_date": "YYYY-MM-DD" (string or null, must be a real date from the document),
  "category_hint": "one of the categories listed above" (string),
  "escalation_stage": "one of: factuur, herinnering, aanmaning, incasso, deurwaarder" (string),
  "currency": "EUR" (string, default EUR)
}

IMPORTANT:
- Return ONLY the JSON object, no other text, no markdown fences
- amount_cents must be an INTEGER in euro cents (€149,00 = 14900)
- If a field cannot be determined, use null (not empty string)
- When in doubt about the amount, always prefer "Te betalen" / "Totaal" over any subtotal`;
}

/**
 * Build a simpler prompt for Gmail email bill classification.
 */
export function buildClassificationPrompt(): string {
  return `Analyze this email and determine if it contains a bill, invoice, or payment request.

Return ONLY a JSON object:
{
  "is_bill": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "vendor": "company name if found",
  "amount_cents": 12345 (if found, in euro cents),
  "due_date": "YYYY-MM-DD" (if found),
  "category_hint": "category if determinable",
  "escalation_stage": "factuur/herinnering/aanmaning/incasso/deurwaarder"
}

Dutch amount format: €1.234,56 = 123456 cents (dots are thousands, comma is decimal).
If not a bill, set is_bill to false and leave other fields null.`;
}
