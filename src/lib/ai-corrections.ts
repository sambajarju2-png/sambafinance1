import { SupabaseClient } from '@supabase/supabase-js';

/**
 * AI Correction Tracking System
 * 
 * Flow:
 * 1. AI extracts data → user sees confirm form
 * 2. User edits fields → saves bill
 * 3. logCorrection() compares AI output vs final values
 * 4. Background: aggregatePatterns() groups corrections by vendor+field
 * 5. Patterns with 3+ unique users become active rules
 * 6. getActivePatterns() returns rules to inject into AI prompts
 */

interface AIExtraction {
  vendor: string | null;
  amount_cents: number | null;
  iban: string | null;
  reference: string | null;
  due_date: string | null;
  category_hint: string | null;
}

interface FinalBill {
  vendor: string;
  amount_cents: number;
  iban: string | null;
  reference: string | null;
  due_date: string;
  category: string;
}

/**
 * Detect the "vendor domain" — a normalized keyword for grouping corrections.
 * E.g., "Coeo Incasso (namens Coolblue)" → "coeo"
 */
export function detectVendorDomain(vendor: string): string {
  const v = vendor.toLowerCase().trim();

  // Known Dutch vendor keywords
  const keywords = [
    'cjib', 'belastingdienst', 'gemeente', 'waterschap',
    'coeo', 'flanderijn', 'syncasso', 'ggn', 'intrum', 'deurwaarderskantoor',
    'ziggo', 'kpn', 't-mobile', 'odido', 'vodafone', 'tele2',
    'eneco', 'vattenfall', 'essent', 'greenchoice', 'budget energie',
    'zilveren kruis', 'vgz', 'cz', 'menzis', 'unive',
    'centraal beheer', 'interpolis', 'nationale-nederlanden',
    'coolblue', 'bol.com', 'wehkamp', 'mediamarkt',
  ];

  for (const kw of keywords) {
    if (v.includes(kw)) return kw;
  }

  // Fallback: first word, lowercased
  return v.split(/\s+/)[0] || 'unknown';
}

/**
 * Compare AI extraction with user's final values.
 * Returns which fields were corrected and logs to DB.
 */
export async function logCorrection(
  supabase: SupabaseClient,
  userId: string,
  source: 'camera_scan' | 'gmail_scan' | 'qr_scan',
  aiResult: AIExtraction,
  finalBill: FinalBill
): Promise<string[]> {
  const corrections: string[] = [];

  // Compare each field
  if (aiResult.vendor && aiResult.vendor !== finalBill.vendor) {
    corrections.push('vendor');
  }
  if (aiResult.amount_cents && aiResult.amount_cents !== finalBill.amount_cents) {
    corrections.push('amount');
  }
  if (aiResult.iban && finalBill.iban && normalizeIban(aiResult.iban) !== normalizeIban(finalBill.iban)) {
    corrections.push('iban');
  }
  if (aiResult.reference && finalBill.reference && aiResult.reference !== finalBill.reference) {
    corrections.push('reference');
  }
  if (aiResult.due_date && aiResult.due_date !== finalBill.due_date) {
    corrections.push('due_date');
  }
  if (aiResult.category_hint && aiResult.category_hint !== finalBill.category) {
    corrections.push('category');
  }

  // Only log if there were actual corrections
  if (corrections.length === 0) return [];

  const vendorDomain = detectVendorDomain(finalBill.vendor);

  await supabase.from('ai_extraction_corrections').insert({
    user_id: userId,
    source,
    ai_vendor: aiResult.vendor,
    ai_amount_cents: aiResult.amount_cents,
    ai_iban: aiResult.iban,
    ai_reference: aiResult.reference,
    ai_due_date: aiResult.due_date,
    ai_category: aiResult.category_hint,
    corrected_vendor: corrections.includes('vendor') ? finalBill.vendor : null,
    corrected_amount_cents: corrections.includes('amount') ? finalBill.amount_cents : null,
    corrected_iban: corrections.includes('iban') ? finalBill.iban : null,
    corrected_reference: corrections.includes('reference') ? finalBill.reference : null,
    corrected_due_date: corrections.includes('due_date') ? finalBill.due_date : null,
    corrected_category: corrections.includes('category') ? finalBill.category : null,
    vendor_domain: vendorDomain,
    fields_corrected: corrections,
  }).then(({ error }) => {
    if (error) console.error('Failed to log AI correction:', error.message);
  });

  // After logging, check if we should create/update a pattern
  await updatePatterns(supabase, vendorDomain, corrections);

  return corrections;
}

/**
 * Check if corrections for this vendor+field reach the threshold (3 unique users).
 * If so, mark the pattern as active.
 */
async function updatePatterns(
  supabase: SupabaseClient,
  vendorDomain: string,
  correctedFields: string[]
): Promise<void> {
  for (const field of correctedFields) {
    // Count unique users who corrected this same vendor+field combo
    const { data, error } = await supabase
      .from('ai_extraction_corrections')
      .select('user_id')
      .eq('vendor_domain', vendorDomain)
      .contains('fields_corrected', [field]);

    if (error || !data) continue;

    // Count unique users
    const uniqueUsers = new Set(data.map((r: { user_id: string }) => r.user_id)).size;
    const totalCorrections = data.length;

    // Generate a rule description based on the pattern
    const ruleDesc = generateRuleDescription(vendorDomain, field, data);

    // Upsert the pattern
    await supabase
      .from('ai_correction_patterns')
      .upsert({
        vendor_keyword: vendorDomain,
        field_name: field,
        rule_description: ruleDesc,
        unique_users_count: uniqueUsers,
        total_corrections: totalCorrections,
        is_active: uniqueUsers >= 3, // Activate at 3+ unique users
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'vendor_keyword,field_name',
      });
  }
}

/**
 * Generate a human-readable rule based on correction patterns.
 * This is what gets injected into the AI prompt.
 */
function generateRuleDescription(
  vendorDomain: string,
  field: string,
  corrections: any[]
): string {
  const vendor = vendorDomain.toUpperCase();

  switch (field) {
    case 'amount':
      return `When extracting from ${vendor}: users frequently correct the amount. Look for "Te betalen" or "Totaal" as the correct amount, not subtotals or base amounts.`;
    case 'iban':
      return `When extracting from ${vendor}: users frequently correct the IBAN. Use the IBAN under "Betaalinformatie" or "Overmaken naar", not header/footer IBANs.`;
    case 'vendor':
      return `When extracting from ${vendor}: users frequently correct the vendor name. Check for "Opdrachtgever" or the actual company name, not the payment processor.`;
    case 'due_date':
      return `When extracting from ${vendor}: users frequently correct the due date. Use the first upcoming date, not past dates or document dates.`;
    case 'category':
      return `When extracting from ${vendor}: users frequently correct the category. Review the vendor type carefully.`;
    case 'reference':
      return `When extracting from ${vendor}: users frequently correct the reference. Look for "Betalingskenmerk", "Dossiernummer", or "Factuurnummer".`;
    default:
      return `When extracting from ${vendor}: users frequently correct the ${field} field.`;
  }
}

/**
 * Get all active correction patterns to inject into AI prompts.
 * Returns max 25 rules, sorted by most corrections first.
 */
export async function getActivePatterns(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from('ai_correction_patterns')
    .select('rule_description, unique_users_count, total_corrections')
    .eq('is_active', true)
    .order('total_corrections', { ascending: false })
    .limit(25);

  if (error || !data || data.length === 0) return [];

  return data.map((p: { rule_description: string }) => p.rule_description);
}

/**
 * Build the correction rules section for the AI prompt.
 * Returns empty string if no active patterns.
 */
export async function buildCorrectionPrompt(
  supabase: SupabaseClient
): Promise<string> {
  const patterns = await getActivePatterns(supabase);
  if (patterns.length === 0) return '';

  return `
LEARNED PATTERNS FROM USER CORRECTIONS (these override default behavior):
${patterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}
`;
}

function normalizeIban(iban: string): string {
  return iban.replace(/\s/g, '').toUpperCase();
}
