/**
 * Extract text from a PDF buffer using pdf-parse.
 *
 * Returns the extracted text, or null if extraction fails.
 * Limits text to 8000 chars to stay within AI context budgets.
 *
 * File: src/lib/pdf-extract.ts
 */

import pdfParse from 'pdf-parse';

const MAX_PDF_TEXT_LENGTH = 8000;
const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — skip huge PDFs

export async function extractPdfText(pdfBuffer: Buffer): Promise<string | null> {
  if (!pdfBuffer || pdfBuffer.length === 0) return null;
  if (pdfBuffer.length > MAX_PDF_SIZE_BYTES) {
    console.log(`[PDF extract] Skipping — too large (${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
    return null;
  }

  try {
    const result = await pdfParse(pdfBuffer, {
      // Limit to first 3 pages — bill details are always on page 1-2
      max: 3,
    });

    const text = (result.text || '').trim();
    if (!text) {
      console.log('[PDF extract] No text found (scanned PDF?)');
      return null;
    }

    // Truncate to stay within AI token budget
    const truncated = text.slice(0, MAX_PDF_TEXT_LENGTH);
    console.log(`[PDF extract] Extracted ${truncated.length} chars from ${result.numpages} pages`);
    return truncated;
  } catch (err) {
    console.error('[PDF extract] Failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
