import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BUCKET = 'payment-confirmations';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/bills/[id]/confirmation — Upload confirmation image
 * DELETE /api/bills/[id]/confirmation — Remove confirmation image
 * GET /api/bills/[id]/confirmation — Get signed URL for viewing
 */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    // Verify bill belongs to user
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('id, user_id')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();

    if (billError || !bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404, headers: NO_CACHE });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400, headers: NO_CACHE });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Bestand is te groot. Maximaal 5MB.' }, { status: 400, headers: NO_CACHE });
    }

    // Determine file extension
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'application/pdf': 'pdf',
    };
    const ext = mimeToExt[file.type] || 'jpg';
    const filePath = `${userId}/${params.id}.${ext}`;

    // Delete any existing file first (might have different extension)
    const { data: existingFiles } = await supabase.storage
      .from(BUCKET)
      .list(userId, { search: params.id });

    if (existingFiles && existingFiles.length > 0) {
      const toDelete = existingFiles
        .filter(f => f.name.startsWith(params.id))
        .map(f => `${userId}/${f.name}`);
      if (toDelete.length > 0) {
        await supabase.storage.from(BUCKET).remove(toDelete);
      }
    }

    // Upload new file
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Upload mislukt' }, { status: 500, headers: NO_CACHE });
    }

    // Get a signed URL (valid for 1 year)
    const { data: signedUrl } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 365 * 24 * 60 * 60); // 1 year

    const url = signedUrl?.signedUrl || null;

    // Save URL to bill
    await supabase
      .from('bills')
      .update({ confirmation_image_url: url })
      .eq('id', params.id)
      .eq('user_id', userId);

    return NextResponse.json({ url }, { status: 200, headers: NO_CACHE });
  } catch (err) {
    console.error('Confirmation upload error:', err);
    return NextResponse.json({ error: 'Upload mislukt' }, { status: 500, headers: NO_CACHE });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    // Verify bill belongs to user
    const { data: bill } = await supabase
      .from('bills')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404, headers: NO_CACHE });
    }

    // Delete all files for this bill
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(userId, { search: params.id });

    if (files && files.length > 0) {
      const toDelete = files
        .filter(f => f.name.startsWith(params.id))
        .map(f => `${userId}/${f.name}`);
      await supabase.storage.from(BUCKET).remove(toDelete);
    }

    // Clear URL from bill
    await supabase
      .from('bills')
      .update({ confirmation_image_url: null })
      .eq('id', params.id)
      .eq('user_id', userId);

    return NextResponse.json({ success: true }, { headers: NO_CACHE });
  } catch (err) {
    console.error('Confirmation delete error:', err);
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500, headers: NO_CACHE });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  try {
    const supabase = await createServerSupabaseClient();

    const { data: bill } = await supabase
      .from('bills')
      .select('confirmation_image_url')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404, headers: NO_CACHE });
    }

    return NextResponse.json({
      url: bill.confirmation_image_url || null,
      has_confirmation: !!bill.confirmation_image_url,
    }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
