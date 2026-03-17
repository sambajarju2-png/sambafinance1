import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { extractBillFromPhoto } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/scan/camera
 *
 * Receives a base64-encoded image of a paper bill.
 * Sends to Gemini Vision for extraction.
 * Returns extracted fields for user confirmation.
 * Image bytes are NEVER stored.
 *
 * Always returns a result — even partial. Missing fields are empty
 * so the user can fill them in the confirm form.
 *
 * Body: { image: string (base64), mime_type: string }
 */
export async function POST(req: NextRequest) {
  const DEADLINE = Date.now() + 55000;
  const guard = () => {
    if (Date.now() > DEADLINE) throw new Error('TIMEOUT_ABORT');
  };

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    // Rate limit: 30 scans per hour
    guard();
    const allowed = await checkRateLimit(userId, 'camera-scan', 30, 3600000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Te veel scans. Probeer het later opnieuw.' },
        { status: 429, headers: NO_CACHE }
      );
    }

    const body = await req.json();
    const { image, mime_type } = body;

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'image (base64) is required' },
        { status: 400, headers: NO_CACHE }
      );
    }

    if (!mime_type || !['image/jpeg', 'image/png', 'image/webp'].includes(mime_type)) {
      return NextResponse.json(
        { error: 'mime_type must be image/jpeg, image/png, or image/webp' },
        { status: 400, headers: NO_CACHE }
      );
    }

    // Check image size (base64 is ~33% larger than binary)
    const estimatedBytes = (image.length * 3) / 4;
    if (estimatedBytes > 3 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Foto is te groot. Maximaal 2MB.' },
        { status: 400, headers: NO_CACHE }
      );
    }

    // Extract bill data with Gemini Vision
    // This now ALWAYS returns a result (possibly partial with empty fields)
    guard();
    const extraction = await extractBillFromPhoto(image, mime_type, userId);

    // Image bytes are discarded here — never stored

    // Check if we got meaningful data
    const hasVendor = extraction.vendor && extraction.vendor !== '';
    const hasAmount = extraction.amount_cents > 0;
    const isPartial = !hasVendor || !hasAmount;

    return NextResponse.json({
      extraction,
      partial: isPartial,
      message: isPartial
        ? 'Niet alle velden konden worden gelezen. Controleer en vul de ontbrekende gegevens in.'
        : null,
    }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504, headers: NO_CACHE });
    }

    const errorMessage = err instanceof Error ? err.message : 'Scannen mislukt';
    console.error('Camera scan error:', errorMessage);

    // Even on error, return a helpful message instead of a 500
    if (errorMessage.includes('foto') || errorMessage.includes('geblokkeerd')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 422, headers: NO_CACHE }
      );
    }

    return NextResponse.json(
      { error: 'Scannen mislukt. Probeer een duidelijkere foto of voer de gegevens handmatig in.' },
      { status: 500, headers: NO_CACHE }
    );
  }
}
