import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { extractBillFromPhoto } from '@/lib/ai';

/**
 * POST /api/scan/camera
 *
 * Receives a base64-encoded image of a paper bill.
 * Sends to Gemini Vision for extraction.
 * Returns extracted fields for user confirmation.
 * Image bytes are NEVER stored.
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
    guard();
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
    // 2MB binary = ~2.67MB base64
    const estimatedBytes = (image.length * 3) / 4;
    if (estimatedBytes > 3 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Maximum 2MB.' },
        { status: 400, headers: NO_CACHE }
      );
    }

    // Extract bill data with Gemini Vision
    guard();
    const extraction = await extractBillFromPhoto(image, mime_type, userId);

    // Image bytes are discarded here — never stored anywhere

    return NextResponse.json({ extraction }, { headers: NO_CACHE });
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT_ABORT') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504, headers: NO_CACHE });
    }
    console.error('Camera scan error:', err);
    return NextResponse.json(
      { error: 'Failed to extract bill data from image' },
      { status: 500, headers: NO_CACHE }
    );
  }
}
