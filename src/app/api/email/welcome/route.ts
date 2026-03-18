import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, emailTemplate } from '@/lib/email';

const NO_CACHE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/email/welcome
 * Body: { email, name, language }
 * Sends the welcome email. Called from onboarding complete.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, name, language } = await req.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400, headers: NO_CACHE });

    const isNl = language !== 'en';
    const firstName = name?.split(' ')[0] || '';

    const subject = isNl
      ? `Welkom bij PayWatch, ${firstName} 🛡️`
      : `Welcome to PayWatch, ${firstName} 🛡️`;

    const html = emailTemplate({
      preheader: isNl ? 'Je bent niet alleen. Wij helpen je.' : "You're not alone. We're here to help.",
      heroText: isNl ? 'Welkom bij PayWatch' : 'Welcome to PayWatch',
      heroSubtext: isNl
        ? 'Rust in je hoofd over elke rekening.'
        : 'Peace of mind for every bill.',
      body: isNl ? `
        <p>Hoi ${firstName},</p>
        <p>Wat fijn dat je er bent. <strong>Je bent niet alleen.</strong></p>
        <p>Meer dan 1,6 miljoen Nederlanders hebben moeite met het bijhouden van rekeningen. En eerlijk? Wij ook.</p>
        <p>PayWatch is gebouwd door <strong>Samba</strong> en <strong>Mariama</strong>. Ondanks dat we financieel prima zaten, gleden rekeningen er toch doorheen. Een vergeten factuur werd een herinnering, werd een aanmaning, en voor je het wist stond het incassobureau aan de deur.</p>
        <p>Dat wilden we nooit meer. Niet voor onszelf, en niet voor jou.</p>
        <p>Daarom bouwden we PayWatch: een app die je inbox scant, je rekeningen bijhoudt, en je op tijd waarschuwt. Zodat jij <strong>rust in je hoofd</strong> hebt.</p>
        <p style="margin-top:24px;padding:16px;background:#F0FDF4;border-radius:12px;text-align:center;font-size:13px;color:#059669;font-weight:600">
          🌿 Ademen. Overzicht krijgen. Actie nemen.
        </p>
      ` : `
        <p>Hey ${firstName},</p>
        <p>Great to have you here. <strong>You're not alone.</strong></p>
        <p>More than 1.6 million people in the Netherlands struggle to keep up with bills. And honestly? So did we.</p>
        <p>PayWatch was built by <strong>Samba</strong> and <strong>Mariama</strong>. Even though we were financially fine, bills still slipped through. A forgotten invoice became a reminder, became a final notice, and before we knew it — collection agencies came knocking.</p>
        <p>We never wanted that again. Not for ourselves, and not for you.</p>
        <p>That's why we built PayWatch: an app that scans your inbox, tracks your bills, and alerts you on time. So you can have <strong>peace of mind</strong>.</p>
        <p style="margin-top:24px;padding:16px;background:#F0FDF4;border-radius:12px;text-align:center;font-size:13px;color:#059669;font-weight:600">
          🌿 Breathe. Get clarity. Take action.
        </p>
      `,
      ctaText: isNl ? 'Open PayWatch' : 'Open PayWatch',
      ctaUrl: 'https://app.hypesamba.com/overzicht',
      footer: isNl
        ? 'PayWatch — Gebouwd in Europa 🇪🇺<br>Je gegevens blijven van jou.'
        : 'PayWatch — Built in Europe 🇪🇺<br>Your data stays yours.',
    });

    const result = await sendEmail({ to: email, subject, html });
    return NextResponse.json(result, { headers: NO_CACHE });
  } catch (err) {
    console.error('Welcome email error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
