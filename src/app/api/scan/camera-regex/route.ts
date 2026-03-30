import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import { extractFromText } from '@/lib/regex-extractor';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/scan/camera-regex
 *
 * Camera scan: Tesseract OCR → DB-powered regex extraction v3.
 * Zero AI. Uses vendor_category_map (291) + incasso_agencies (270) + learned corrections.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image } = await req.json();
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const startTime = Date.now();

    // 1. OCR
    const buffer = Buffer.from(image, 'base64');
    const worker = await createWorker('nld+eng');
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    const ocrMs = Date.now() - startTime;

    if (!data.text || data.text.trim().length < 10) {
      return NextResponse.json({ error: 'Could not read text from image.' }, { status: 422 });
    }

    // 2. DB-powered regex extraction (async — queries Supabase)
    const regexStart = Date.now();
    const extraction = await extractFromText(data.text);
    const regexMs = Date.now() - regexStart;

    return NextResponse.json({
      extraction: {
        vendor: extraction.vendor || '',
        amount_cents: extraction.amount_cents || 0,
        currency: 'EUR',
        iban: extraction.iban,
        reference: extraction.reference,
        due_date: extraction.due_date,
        category_hint: extraction.category_hint,
        escalation_stage: extraction.escalation_stage,
        payment_url: extraction.payment_url,
        is_incasso: extraction.is_incasso,
        confidence: {
          vendor: extraction.vendor ? 0.8 : 0,
          amount: extraction.amount_cents ? 0.95 : 0,
          due_date: extraction.due_date ? 0.8 : 0,
        },
      },
      ocr_text: data.text.slice(0, 1000),
      ocr_confidence: data.confidence,
      method: 'regex',
      fields_found: extraction.fields_found,
      match_sources: extraction.match_sources,
      extraction_confidence: extraction.confidence,
      timing: { ocr_ms: ocrMs, regex_ms: regexMs, total_ms: Date.now() - startTime },
    });
  } catch (err) {
    console.error('[Camera Regex Scan]', err);
    return NextResponse.json(
      { error: 'Extraction failed', detail: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  }
}
