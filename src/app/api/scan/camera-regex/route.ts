import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import { extractFromText } from '@/lib/regex-extractor';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/scan/camera-regex
 *
 * Camera scan using Tesseract OCR + regex extraction v2.
 * ZERO AI calls. Fully deterministic.
 *
 * v2: now returns escalation_stage, category_hint, kvk_number
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image, mime_type } = await req.json();
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const startTime = Date.now();

    // 1. OCR with Tesseract.js (Dutch + English)
    const buffer = Buffer.from(image, 'base64');
    const worker = await createWorker('nld+eng');
    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    const ocrMs = Date.now() - startTime;
    const ocrText = data.text;
    const ocrConfidence = data.confidence;

    if (!ocrText || ocrText.trim().length < 10) {
      return NextResponse.json({
        error: 'Could not read text from image. Try a clearer photo.',
        ocr_confidence: ocrConfidence,
      }, { status: 422 });
    }

    // 2. Regex extraction
    const regexStart = Date.now();
    const extraction = extractFromText(ocrText);
    const regexMs = Date.now() - regexStart;

    // 3. Return result
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
        confidence: {
          vendor: extraction.vendor ? 0.8 : 0,
          amount: extraction.amount_cents ? 0.95 : 0,
          due_date: extraction.due_date ? 0.8 : 0,
        },
      },
      ocr_text: ocrText.slice(0, 1000),
      ocr_confidence: ocrConfidence,
      method: 'regex',
      fields_found: extraction.fields_found,
      extraction_confidence: extraction.confidence,
      timing: {
        ocr_ms: ocrMs,
        regex_ms: regexMs,
        total_ms: Date.now() - startTime,
      },
    });
  } catch (err) {
    console.error('[Camera Regex Scan]', err);
    return NextResponse.json(
      { error: 'Extraction failed', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
