import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, buildWelcomeEmail } from '@/lib/email';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  // Require auth OR cron secret
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '');
  const userId = await getAuthUserId();
  if (!userId && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });
  }

  try {
    const { email, name, language } = await req.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    const { subject, html } = buildWelcomeEmail(name || '', language || 'nl');
    return NextResponse.json(await sendEmail({ to: email, subject, html }));
  } catch (err) {
    console.error('Welcome email error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
