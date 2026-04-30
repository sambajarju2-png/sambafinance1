import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { logAiUsage } from '@/lib/ai/usage-log';

const SCALEWAY_API_URL = 'https://api.scaleway.ai/v1/chat/completions';
const VISION_MODEL = 'mistral-small-3.2-24b-instruct-2506';

const NO_CACHE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/voice/scan-image
 * Accepts an image (multipart/form-data, field: "file").
 * Analyses it with Mistral Vision via Scaleway EU.
 * Returns a plain Dutch spoken summary + extracted fields.
 * Used by PayBuddy voice call to describe scanned documents.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const apiKey = process.env.SCW_SECRET_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Vision not configured' }, { status: 500, headers: NO_CACHE });

  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get('file') as File | null;
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400, headers: NO_CACHE });
  }

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400, headers: NO_CACHE });

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ spoken: 'De foto is te groot. Probeer een kleinere foto.', error: 'too_large' }, { headers: NO_CACHE });
  }

  try {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const startTime = Date.now();

    const response = await fetch(SCALEWAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
              {
                type: 'text',
                text: `Dit is een foto die een gebruiker heeft gedeeld tijdens een gesprek met een financiële assistent.

Analyseer de afbeelding en geef:
1. Een korte, gesproken beschrijving in het Nederlands (max 2-3 zinnen) die de assistent hardop kan voorlezen. Begin met wat je ziet.
2. Als het een rekening/brief/factuur is: extraheer afzender, bedrag, vervaldatum en type document.
3. Als het geen financieel document is: beschrijf kort wat je ziet.

Geef je antwoord in dit EXACTE JSON-formaat (geen andere tekst):
{
  "spoken": "De gesproken beschrijving die voorgelezen wordt",
  "vendor": "naam afzender of null",
  "amount_cents": getal of null,
  "due_date": "YYYY-MM-DD of null",
  "escalation_stage": "factuur/herinnering/aanmaning/incasso/deurwaarder of null",
  "is_bill": true of false,
  "reference": "kenmerk of null"
}`,
              },
            ],
          },
        ],
        // Note: no response_format: json_object — vision + JSON mode can conflict
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ScanImage] Mistral error:', response.status, errText);
      return NextResponse.json({
        spoken: 'Ik kon de foto niet analyseren. Probeer een duidelijkere foto.',
        error: 'vision_error',
      }, { headers: NO_CACHE });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const tokensIn = data.usage?.prompt_tokens || 0;
    const tokensOut = data.usage?.completion_tokens || 0;
    const costCents = (tokensIn * 0.000015) + (tokensOut * 0.000035);

    await logAiUsage({
      userId, model: VISION_MODEL, operation: 'voice_scan_image',
      tokensIn, tokensOut, costCents, durationMs,
    });

    // Parse JSON from response
    let parsed: Record<string, unknown> = {};
    try {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      }
    } catch {
      // Fallback: use raw content as spoken text
      parsed.spoken = content.trim().replace(/```json|```/g, '').trim() || 'Ik heb de foto bekeken maar kon geen details herleiden.';
    }

    const spoken = String(parsed.spoken || 'Ik heb de foto bekeken.');

    return NextResponse.json({
      spoken,
      vendor: parsed.vendor || null,
      amount_cents: parsed.amount_cents || null,
      due_date: parsed.due_date || null,
      escalation_stage: parsed.escalation_stage || null,
      is_bill: parsed.is_bill || false,
      reference: parsed.reference || null,
    }, { headers: NO_CACHE });

  } catch (err) {
    console.error('[ScanImage] Error:', err);
    return NextResponse.json({
      spoken: 'Er ging iets mis bij het scannen van de foto. Probeer het opnieuw.',
      error: 'internal',
    }, { headers: NO_CACHE });
  }
}
