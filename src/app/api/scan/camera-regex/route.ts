import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import { extractFromText } from '@/lib/regex-extractor';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/scan/camera-regex
 *
 * Camera scan using Tesseract OCR + regex extraction.
 * ZERO AI calls. Fully deterministic.
 *
 * Input: { image: base64, mime_type: string }
 * Output: { extraction: {...}, ocr_text: string, method: 'regex' }
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

    // 1. OCR with Tesseract.js (Dutch + English)
    const buffer = Buffer.from(image, 'base64');
    const worker = await createWorker('nld+eng');
    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    const ocrText = data.text;
    const ocrConfidence = data.confidence; // 0-100

    if (!ocrText || ocrText.trim().length < 10) {
      return NextResponse.json({
        error: 'Could not read text from image. Try a clearer photo.',
        ocr_confidence: ocrConfidence,
      }, { status: 422 });
    }

    // 2. Regex extraction from OCR text
    const extraction = extractFromText(ocrText);

    // 3. Return result
    return NextResponse.json({
      extraction: {
        vendor: extraction.vendor || '',
        amount_cents: extraction.amount_cents || 0,
        currency: 'EUR',
        iban: extraction.iban,
        reference: extraction.reference,
        due_date: extraction.due_date,
        category_hint: 'overig', // regex doesn't categorize — DB lookup handles this
        escalation_stage: null, // regex can't detect this — would need AI
        payment_url: extraction.payment_url,
        confidence: {
          vendor: extraction.vendor ? 0.7 : 0,
          amount: extraction.amount_cents ? 0.9 : 0,
          due_date: extraction.due_date ? 0.7 : 0,
        },
      },
      ocr_text: ocrText.slice(0, 500), // return first 500 chars for debugging
      ocr_confidence: ocrConfidence,
      method: 'regex',
      fields_found: extraction.fields_found,
    });
  } catch (err) {
    console.error('[Camera Regex Scan]', err);
    return NextResponse.json(
      { error: 'Extraction failed', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
