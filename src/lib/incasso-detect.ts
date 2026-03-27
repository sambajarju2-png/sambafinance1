/**
 * Incasso Agency Detection
 * 
 * Checks vendor names against the official Dutch Justis Incasso Register (270 agencies).
 * Used in the AI extraction pipeline to:
 * 1. Auto-detect if a bill is from a collection agency → category = 'incasso'
 * 2. Auto-set escalation_stage to 'incasso' (minimum)
 * 3. Fuzzy match misspelled/partial vendor names
 * 4. Provide the AI model with autocomplete suggestions
 * 
 * File: src/lib/incasso-detect.ts (sambafinance1 repo)
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';

export type IncassoMatch = {
  matched: boolean;
  agency_name: string | null;
  registration_number: string | null;
  nvi_keurmerk: boolean;
  confidence: 'exact' | 'partial' | 'fuzzy' | 'none';
  suggested_category: 'incasso';
  suggested_escalation: 'incasso' | 'deurwaarder';
};

const NO_MATCH: IncassoMatch = {
  matched: false,
  agency_name: null,
  registration_number: null,
  nvi_keurmerk: false,
  confidence: 'none',
  suggested_category: 'incasso',
  suggested_escalation: 'incasso',
};

/**
 * Check if a vendor name matches a known incasso agency.
 * Uses 3 strategies: exact match, partial (ILIKE), and fuzzy (trigram).
 */
export async function detectIncassoAgency(vendorName: string): Promise<IncassoMatch> {
  if (!vendorName || vendorName.trim().length < 3) return NO_MATCH;

  const supabase = await createServerSupabaseClient();
  const search = vendorName.toLowerCase()
    .replace(/\bb\.?v\.?\b/gi, '')
    .replace(/\bn\.?v\.?\b/gi, '')
    .replace(/\bgmbh\b/gi, '')
    .replace(/["""]/g, '')
    .trim();

  // Strategy 1: Exact match on search_name
  const { data: exact } = await supabase
    .from('incasso_agencies')
    .select('name, registration_number, nvi_keurmerk')
    .eq('search_name', search)
    .limit(1);

  if (exact && exact.length > 0) {
    return {
      matched: true,
      agency_name: exact[0].name,
      registration_number: exact[0].registration_number,
      nvi_keurmerk: exact[0].nvi_keurmerk,
      confidence: 'exact',
      suggested_category: 'incasso',
      suggested_escalation: detectEscalation(vendorName),
    };
  }

  // Strategy 2: Partial match (vendor name contains agency name or vice versa)
  const { data: partial } = await supabase
    .from('incasso_agencies')
    .select('name, registration_number, nvi_keurmerk, search_name')
    .or(`search_name.ilike.%${search}%,search_name.ilike.${search}%`)
    .limit(3);

  if (partial && partial.length > 0) {
    // Pick the best match (shortest name = most specific)
    const best = partial.sort((a, b) => a.search_name.length - b.search_name.length)[0];
    return {
      matched: true,
      agency_name: best.name,
      registration_number: best.registration_number,
      nvi_keurmerk: best.nvi_keurmerk,
      confidence: 'partial',
      suggested_category: 'incasso',
      suggested_escalation: detectEscalation(vendorName),
    };
  }

  // Strategy 3: Fuzzy trigram match (handles typos/OCR errors)
  const { data: fuzzy } = await supabase
    .rpc('match_incasso_agency', { query_name: search });

  if (fuzzy && fuzzy.length > 0 && fuzzy[0].score > 0.25) {
    return {
      matched: true,
      agency_name: fuzzy[0].name,
      registration_number: fuzzy[0].registration_number,
      nvi_keurmerk: fuzzy[0].nvi_keurmerk,
      confidence: 'fuzzy',
      suggested_category: 'incasso',
      suggested_escalation: detectEscalation(vendorName),
    };
  }

  // Strategy 4: Keyword detection (even if not in register)
  if (hasIncassoKeywords(vendorName)) {
    return {
      matched: true,
      agency_name: null, // Not in register, but clearly incasso
      registration_number: null,
      nvi_keurmerk: false,
      confidence: 'partial',
      suggested_category: 'incasso',
      suggested_escalation: detectEscalation(vendorName),
    };
  }

  return NO_MATCH;
}

/**
 * Check for incasso/deurwaarder keywords in vendor name or bill context
 */
function hasIncassoKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    'incasso', 'incassobureau', 'debt collect', 'collection',
    'deurwaarder', 'gerechtsdeurwaarder', 'bailiff',
    'debiteur', 'vordering', 'invordering',
    'credit management', 'creditmanagement',
  ];
  return keywords.some(kw => lower.includes(kw));
}

/**
 * Determine escalation stage from context.
 * Default is 'incasso', but if deurwaarder keywords are present → 'deurwaarder'
 */
function detectEscalation(text: string): 'incasso' | 'deurwaarder' {
  const lower = text.toLowerCase();
  const deurwaarderKeywords = [
    'deurwaarder', 'gerechtsdeurwaarder', 'bailiff',
    'beslag', 'executie', 'dagvaarding', 'vonnis',
    'exploot', 'betekening',
  ];
  return deurwaarderKeywords.some(kw => lower.includes(kw)) ? 'deurwaarder' : 'incasso';
}

/**
 * Get autocomplete suggestions for a partial vendor name.
 * Useful for the AI model when the OCR/extraction isn't fully clear.
 */
export async function suggestIncassoAgency(partialName: string, limit = 5): Promise<string[]> {
  if (!partialName || partialName.length < 2) return [];

  const supabase = await createServerSupabaseClient();
  const search = partialName.toLowerCase().replace(/\bb\.?v\.?\b/gi, '').trim();

  const { data } = await supabase
    .from('incasso_agencies')
    .select('name')
    .ilike('search_name', `%${search}%`)
    .order('nvi_keurmerk', { ascending: false }) // NVI certified first
    .limit(limit);

  return data?.map(d => d.name) ?? [];
}
