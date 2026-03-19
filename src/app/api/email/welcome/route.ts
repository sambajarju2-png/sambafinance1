import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, buildWelcomeEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email, name, language } = await req.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    const { subject, html } = buildWelcomeEmail(name || '', language !== 'en');
    return NextResponse.json(await sendEmail({ to: email, subject, html }));
  } catch (err) {
    console.error('Welcome email error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
