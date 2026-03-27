/**
 * PayWatch AI Extraction Prompt Builder
 * 
 * Builds the system prompt for Gemini Flash with:
 * 1. Base extraction instructions
 * 2. Dutch-specific invoice rules
 * 3. Dynamic correction patterns from user feedback
 * 4. Known vendor context from database (291+ vendors)
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

AMOUNT PARSING (CRITICAL — Dutch format, common mistakes):
- € 1.234,56 = 123456 cents (dot = thousands separator, comma = decimal)
- € 127,43 = 12743 cents
- € 15,- = 1500 cents (dash after comma means zero cents)
- € 15,00 = 1500 cents
- € 15 = 1500 cents (no decimals = whole euros)
- € 0,75 = 75 cents
- € 1234 = 123400 cents (no separator = whole euros, NOT 1234 cents)
- € 1.280,00 = 128000 cents (remove dot as thousands separator)
- WRONG: € 1.234,56 ≠ 1234.56 (that is English format, NOT Dutch)
- WRONG: € 1234 ≠ 1234 cents (it means twelve hundred thirty four euros)

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
- If "namens", "in opdracht van", or "Opdrachtgever" appears, ALWAYS include both parties
- For government: use the exact entity name: "CJIB", "Belastingdienst", "Gemeente [naam]"
- Use the SENDER of the invoice, not the payment processor
- If the sender is a payment processor (Mollie, Adyen, Buckaroo), look for the actual merchant name
- Historical names: Infoscore = Riverty, Afterpay = Riverty, T-Mobile = Odido, AllSecur = Allianz Direct, XS4ALL = KPN

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

=== PAYMENT URL ===
- Look for: "Betaal direct via", "Online betalen", "Betaallink", "iDEAL link", QR code URLs
- Common patterns: tikkie.me, betaalverzoek.rabobank.nl, ideal links, pay.nl links
- If a URL is present for online payment, extract the full URL
- If no payment URL found, return null

=== CATEGORY ===
Must be exactly one of: wonen, nutsvoorzieningen, zorg, verzekeringen, telecom, overheid, vervoer, leningen, winkels, abonnementen, gezin, zakelijk, incasso, overig

Category detection rules:
- wonen: huur, hypotheek, servicekosten, VvE bijdrage, woningcorporatie (Vestia, Woonbron, Havensteder, Ymere, Stadgenoot, Rochdale, Staedion, Portaal, De Alliantie, Woonstad, Heimstaden, Lieven de Key)
- nutsvoorzieningen: gas, elektriciteit, water, stadsverwarming (Eneco, Vattenfall, Essent, Greenchoice, Budget Energie, Vandebron, Pure Energie, Oxxio, Frank Energie, Vitens, Waternet, Brabant Water, PWN, Dunea, Evides, WML, Oasen)
- zorg: huisarts, tandarts, ziekenhuis, apotheek, GGZ, fysiotherapie, eigen risico, Infomedics, Erasmus MC, UMC, BENU, Bergman Clinics
- verzekeringen: zorgverzekering, autoverzekering, inboedel, aansprakelijkheid, uitvaart (Zilveren Kruis, VGZ, CZ, Menzis, ONVZ, DSW, Centraal Beheer, Interpolis, Nationale-Nederlanden, a.s.r., FBTO, InShared, Allianz Direct, DELA, Monuta, Univé, OHRA, Promovendum)
- telecom: telefoon, internet, TV, mobiel (KPN, Ziggo, Odido, T-Mobile, Vodafone, Tele2, Youfone, Simyo, Ben, Simpel, Hollandsnieuwe, DELTA Fiber, Caiway, Freedom Internet)
- overheid: CJIB, Belastingdienst, DUO, gemeente, waterschap, hoogheemraadschap, CAK, SVB, UWV, rioolheffing, afvalstoffenheffing, OZB, waterschapsbelasting (includes regional: BSGR, SVHW, Cocensus, Tribuut, Munitax, BGHU)
- vervoer: OV, NS, auto-onderhoud, RDW, parkeerboete, wegenbelasting, ANWB, Q-Park, EasyPark, GVB, RET, HTM, Arriva, Connexxion
- leningen: persoonlijke lening, doorlopend krediet, studiefinanciering, hypotheek aflossing, BNPL (ING, ABN AMRO, Rabobank, Florius, NIBC, Santander, DEFAM, Freo, Tinka)
- incasso: incassobureau, deurwaarder, collection agency, vordering namens (Intrum, GGN, Flanderijn, Syncasso, Coeo, Riverty, Cannock, Troy, Bos Incasso, Direct Pay — also any vendor with "namens" or "in opdracht van")
- winkels: webshop order, Afterpay, Klarna, Billink (Bol.com, Coolblue, Wehkamp, Zalando, MediaMarkt, IKEA, Picnic, Albert Heijn)
- abonnementen: streaming, sportschool, software, tijdschrift, lidmaatschap (Netflix, Spotify, Disney+, Videoland, HBO Max, Basic-Fit, TrainMore, Adobe, Microsoft 365, HelloFresh, De Telegraaf, NRC)
- gezin: kinderopvang, school, BSO, sportvereniging (Partou, Smallsteps, Humankind, Kindergarden, Korein)
- zakelijk: zakelijke dienstverlening, boekhouder, KvK
- overig: anything that does not fit above, payment processors (Mollie, Adyen, Buckaroo), charities, lottery

=== ESCALATION STAGE ===
Must be exactly one of: factuur, herinnering, aanmaning, incasso, deurwaarder

Detection rules:
- "incasso", "incassobureau", "buitengerechtelijke", "dossier overgedragen", "uit handen gegeven" → "incasso"
- "deurwaarder", "gerechtsdeurwaarder", "gerechtelijk", "dagvaarding", "beslag", "exploot", "betekening", "vonnis", "executie" → "deurwaarder"  
- "aanmaning", "laatste waarschuwing", "ingebrekestelling", "sommatie", "wij sommeren u" → "aanmaning"
- "herinnering", "betalingsherinnering", "tweede verzoek", "vriendelijk verzoek nogmaals" → "herinnering"
- Default (normal invoice with no escalation language) → "factuur"
- If the vendor is a known incasso agency, minimum stage = "incasso" (even if the letter says "factuur")
`;

const ENGLISH_CONTEXT = `
NOTE: While the interface supports English, virtually all Dutch invoices/letters are in Dutch.
However, some international companies (e.g., Apple, Google, Amazon) send invoices in English.
Apply the same extraction logic regardless of language.
`;

/**
 * Build the complete extraction prompt for photo/image scanning.
 * @param correctionRules - Dynamic rules from user correction patterns (can be empty)
 * @param vendorContext - Known Dutch vendors from database (optional, injected by pipeline)
 */
export function buildExtractionPrompt(correctionRules: string = '', vendorContext: string = ''): string {
  return `You are an expert Dutch invoice/bill data extractor. Extract structured payment data from this image of a Dutch bill, invoice, fine, or letter.

${DUTCH_INVOICE_RULES}

${ENGLISH_CONTEXT}

${correctionRules}

${vendorContext}

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
  "payment_url": "https://..." (string or null, any payment link found),
  "currency": "EUR" (string, default EUR),
  "confidence": {"vendor": 0.0-1.0, "amount": 0.0-1.0, "due_date": 0.0-1.0}
}

IMPORTANT:
- Return ONLY the JSON object, no other text, no markdown fences
- amount_cents must be an INTEGER in euro cents (€149,00 = 14900)
- If a field cannot be determined, use null (not empty string)
- When in doubt about the amount, always prefer "Te betalen" / "Totaal" over any subtotal
- If the vendor is an incasso bureau or deurwaarder, set escalation_stage accordingly (minimum "incasso")`;
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
€ 15,- = 1500 cents (dash = zero cents).
€ 1234 = 123400 cents (no separator = whole euros).
If not a bill, set is_bill to false and leave other fields null.`;
}
