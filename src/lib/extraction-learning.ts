/**
 * PayWatch Extraction Learning Module
 *
 * Stores user corrections and applies them to future scans.
 * No AI — just a feedback loop: user corrects → we remember → next time we get it right.
 *
 * How it works:
 * 1. User scans a bill → regex extracts "Eneoo" as vendor
 * 2. User corrects to "Eneco" on the confirmation screen
 * 3. We store: { ocr_text: "Eneoo", corrected_vendor: "Eneco" }
 * 4. Next scan that produces "Eneoo" → we auto-correct to "Eneco"
 *
 * Also learns:
 * - Sender domain → vendor name (from email scans)
 * - Vendor → category mapping
 * - Vendor → IBAN mapping (for validation)
 *
 * SERVER-ONLY — never import in client components.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';

// ============================================================
// 1. RECORD A CORRECTION
// ============================================================

interface CorrectionInput {
  /** What regex/OCR originally extracted as vendor */
  original_vendor: string | null;
  /** What the user corrected it to */
  corrected_vendor: string;
  /** Email sender domain (if from email scan) */
  sender_domain?: string | null;
  /** Corrected IBAN (if user fixed it) */
  corrected_iban?: string | null;
  /** Corrected category */
  corrected_category?: string | null;
  /** Source: 'camera_scan' | 'email_scan' | 'qr_scan' */
  source: string;
}

export async function recordCorrection(input: CorrectionInput): Promise<void> {
  const supabase = createServiceRoleClient();
  const ocrText = (input.original_vendor || '').toLowerCase().trim();
  const correctedVendor = input.corrected_vendor.trim();

  if (!ocrText || !correctedVendor) return;
  if (ocrText === correctedVendor.toLowerCase()) return; // no correction needed

  // Check if we already have this correction
  const { data: existing } = await supabase
    .from('vendor_corrections')
    .select('id, times_seen')
    .eq('ocr_text', ocrText)
    .eq('corrected_vendor', correctedVendor)
    .single();

  if (existing) {
    // Increment times_seen
    await supabase
      .from('vendor_corrections')
      .update({
        times_seen: existing.times_seen + 1,
        updated_at: new Date().toISOString(),
        // Update optional fields if provided
        ...(input.sender_domain ? { sender_domain: input.sender_domain } : {}),
        ...(input.corrected_iban ? { corrected_iban: input.corrected_iban } : {}),
        ...(input.corrected_category ? { corrected_category: input.corrected_category } : {}),
      })
      .eq('id', existing.id);
  } else {
    // Insert new correction
    await supabase.from('vendor_corrections').insert({
      ocr_text: ocrText,
      corrected_vendor: correctedVendor,
      sender_domain: input.sender_domain || null,
      corrected_iban: input.corrected_iban || null,
      corrected_category: input.corrected_category || null,
      source: input.source,
    });
  }
}

// ============================================================
// 2. APPLY LEARNED CORRECTIONS TO AN EXTRACTION
// ============================================================

interface LearnedCorrection {
  corrected_vendor: string;
  corrected_iban: string | null;
  corrected_category: string | null;
  times_seen: number;
}

/**
 * Look up if we have a learned correction for a vendor string.
 * Returns the corrected vendor name (and optional IBAN/category) if found.
 */
export async function applyLearnedCorrections(
  extractedVendor: string | null,
  senderDomain?: string | null
): Promise<LearnedCorrection | null> {
  if (!extractedVendor && !senderDomain) return null;

  const supabase = createServiceRoleClient();

  // Priority 1: Match by sender domain (100% reliable)
  if (senderDomain) {
    const { data: domainMatch } = await supabase
      .from('vendor_corrections')
      .select('corrected_vendor, corrected_iban, corrected_category, times_seen')
      .eq('sender_domain', senderDomain.toLowerCase())
      .order('times_seen', { ascending: false })
      .limit(1)
      .single();

    if (domainMatch) return domainMatch;
  }

  // Priority 2: Match by OCR text (fuzzy from previous corrections)
  if (extractedVendor) {
    const ocrText = extractedVendor.toLowerCase().trim();

    const { data: textMatch } = await supabase
      .from('vendor_corrections')
      .select('corrected_vendor, corrected_iban, corrected_category, times_seen')
      .eq('ocr_text', ocrText)
      .order('times_seen', { ascending: false })
      .limit(1)
      .single();

    if (textMatch) return textMatch;
  }

  return null;
}

// ============================================================
// 3. RECORD A DOMAIN → VENDOR MAPPING FROM EMAIL SCAN
// ============================================================

/**
 * When a user receives a bill from a new sender domain and confirms/corrects
 * the vendor name, record the domain mapping so future emails are instant.
 */
export async function recordDomainMapping(
  senderDomain: string,
  vendorName: string,
  category?: string
): Promise<void> {
  const supabase = createServiceRoleClient();
  const domain = senderDomain.toLowerCase().trim();

  if (!domain || !vendorName) return;

  // Upsert: if domain already mapped, update; otherwise insert
  const { data: existing } = await supabase
    .from('vendor_corrections')
    .select('id, times_seen')
    .eq('sender_domain', domain)
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from('vendor_corrections')
      .update({
        corrected_vendor: vendorName,
        times_seen: existing.times_seen + 1,
        updated_at: new Date().toISOString(),
        ...(category ? { corrected_category: category } : {}),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('vendor_corrections').insert({
      ocr_text: domain, // store domain as ocr_text too for searchability
      corrected_vendor: vendorName,
      sender_domain: domain,
      corrected_category: category || null,
      source: 'email_scan',
    });
  }
}

// ============================================================
// 4. GET ALL LEARNED VENDORS (for expanding the domain map)
// ============================================================

/**
 * Returns all learned vendor corrections, useful for:
 * - Exporting to expand the hardcoded DOMAIN_VENDOR_MAP
 * - Debugging extraction accuracy
 * - Building analytics on correction patterns
 */
export async function getAllLearnedVendors(): Promise<
  Array<{
    ocr_text: string;
    corrected_vendor: string;
    sender_domain: string | null;
    corrected_category: string | null;
    times_seen: number;
  }>
> {
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('vendor_corrections')
    .select('ocr_text, corrected_vendor, sender_domain, corrected_category, times_seen')
    .order('times_seen', { ascending: false })
    .limit(500);

  return data || [];
}
