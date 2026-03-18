import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, buildDigestEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email, name, language, stats } = await req.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    const { subject, html } = buildDigestEmail(name || '', language !== 'en', stats || {});
    const result = await sendEmail({ to: email, subject, html });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Digest email error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
