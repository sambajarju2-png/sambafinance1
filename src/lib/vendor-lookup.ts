/**
 * Vendor Category Lookup
 * 
 * Checks vendor names against the vendor_category_map table BEFORE AI runs.
 * This means ~70% of Dutch bills get instant, free, 100% accurate categorization.
 * 
 * Lookup order:
 * 1. vendor_category_map (291+ known Dutch vendors)
 * 2. incasso_agencies (270 Justis-registered collection agencies)
 * 3. Keywords (incasso, deurwaarder, etc.)
 * 4. Falls through → AI decides
 * 
 * MATCHING RULES:
 * - Patterns ≤ 4 chars (NS, CZ, GVB, DUO): must match as a WHOLE WORD
 *   → "NS" matches "NS Reizigers" but NOT "Incassons" or "Pensioenfonds"
 * - Patterns > 4 chars (eneco, ziggo, riverty): substring match is fine
 *   → "eneco" matches "Eneco Energie B.V."
 * 
 * File: src/lib/vendor-lookup.ts (sambafinance1 repo)
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';

export type VendorLookupResult = {
  matched: boolean;
  category: string | null;
  display_name: string | null;
  is_incasso: boolean;
  is_government: boolean;
  suggested_escalation: string | null;
};

const NO_MATCH: VendorLookupResult = {
  matched: false,
  category: null,
  display_name: null,
  is_incasso: false,
  is_government: false,
  suggested_escalation: null,
};

/**
 * Check if a pattern matches the search string.
 * Short patterns (≤4 chars) require whole-word matching to prevent false positives.
 * Long patterns (>4 chars) use substring matching.
 */
function patternMatches(search: string, pattern: string): boolean {
  const cleanPattern = pattern.trim();
  
  if (cleanPattern.length <= 4) {
    // Whole-word match: pattern must be surrounded by word boundaries
    // "ns" matches "ns reizigers" or "ns" alone, but NOT "incassons" or "pensioenfonds"
    const regex = new RegExp(`(?:^|[\\s,.()/\\-])${escapeRegex(cleanPattern)}(?:$|[\\s,.()/\\-])`, 'i');
    return regex.test(` ${search} `); // pad with spaces so start/end patterns work
  }
  
  // Long patterns: simple substring match
  return search.includes(cleanPattern);
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Look up a vendor name against known Dutch billers.
 * Call this BEFORE sending to AI — if it matches, skip AI category detection.
 */
export async function lookupVendor(vendorName: string): Promise<VendorLookupResult> {
  if (!vendorName || vendorName.trim().length < 2) return NO_MATCH;

  const search = vendorName.toLowerCase()
    .replace(/\bb\.?v\.?\b/gi, '')
    .replace(/\bn\.?v\.?\b/gi, '')
    .replace(/\bgmbh\b/gi, '')
    .replace(/["""()]/g, '')
    .trim();

  const supabase = await createServerSupabaseClient();

  // === Step 1: Check vendor_category_map ===
  // Fetch all patterns, sorted longest first (most specific matches first)
  const { data: vendorMatch } = await supabase
    .from('vendor_category_map')
    .select('vendor_pattern, category, vendor_display_name')
    .order('vendor_pattern', { ascending: false });

  if (vendorMatch) {
    // Sort by pattern length descending — longer (more specific) patterns match first
    const sorted = vendorMatch.sort((a, b) => b.vendor_pattern.length - a.vendor_pattern.length);
    
    for (const row of sorted) {
      if (patternMatches(search, row.vendor_pattern)) {
        const isGov = row.category === 'overheid';
        return {
          matched: true,
          category: row.category,
          display_name: row.vendor_display_name || vendorName,
          is_incasso: row.category === 'incasso',
          is_government: isGov,
          suggested_escalation: null,
        };
      }
    }
  }

  // === Step 2: Check incasso_agencies (270 Justis register) ===
  const { data: incassoExact } = await supabase
    .from('incasso_agencies')
    .select('name, search_name')
    .or(`search_name.ilike.%${search}%`);

  if (incassoExact && incassoExact.length > 0) {
    return {
      matched: true,
      category: 'incasso',
      display_name: incassoExact[0].name,
      is_incasso: true,
      is_government: false,
      suggested_escalation: detectEscalationFromText(vendorName),
    };
  }

  // === Step 3: Keyword-based detection ===
  const incassoKeywords = ['incasso', 'deurwaarder', 'gerechtsdeurwaarder', 'debt collect', 'collection agency', 'vordering', 'invordering'];
  if (incassoKeywords.some(kw => search.includes(kw))) {
    return {
      matched: true,
      category: 'incasso',
      display_name: null,
      is_incasso: true,
      is_government: false,
      suggested_escalation: detectEscalationFromText(vendorName),
    };
  }

  const govKeywords = ['gemeente ', 'waterschapsbelasting', 'rijksoverheid', 'belasting'];
  if (govKeywords.some(kw => search.includes(kw))) {
    return {
      matched: true,
      category: 'overheid',
      display_name: null,
      is_incasso: false,
      is_government: true,
      suggested_escalation: null,
    };
  }

  return NO_MATCH;
}

/**
 * Detect escalation stage from bill text context
 */
function detectEscalationFromText(text: string): string {
  const lower = text.toLowerCase();
  if (['deurwaarder', 'gerechtsdeurwaarder', 'beslag', 'dagvaarding', 'vonnis', 'exploot'].some(kw => lower.includes(kw))) {
    return 'deurwaarder';
  }
  if (['incasso', 'collection', 'vordering'].some(kw => lower.includes(kw))) {
    return 'incasso';
  }
  if (['aanmaning', 'formal notice', 'laatste waarschuwing'].some(kw => lower.includes(kw))) {
    return 'aanmaning';
  }
  if (['herinnering', 'reminder', 'betalingsherinnering'].some(kw => lower.includes(kw))) {
    return 'herinnering';
  }
  return 'factuur';
}

/**
 * Build a vendor context string for AI prompts.
 * Inject this into Haiku/Gemini prompts so the AI knows common Dutch vendors.
 */
export async function buildVendorContext(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  
  const { data } = await supabase
    .from('vendor_category_map')
    .select('vendor_pattern, category')
    .order('category');

  if (!data || data.length === 0) return '';

  // Group by category
  const grouped: Record<string, string[]> = {};
  for (const row of data) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row.vendor_pattern);
  }

  let context = '\nKNOWN DUTCH VENDORS (use these for category detection):\n';
  for (const [category, vendors] of Object.entries(grouped)) {
    context += `- ${category}: ${vendors.join(', ')}\n`;
  }

  return context;
}
