import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, emailTemplate } from '@/lib/email';

const NO_CACHE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/email/features
 * Body: { email, name, language }
 * Sends the features overview email (day 2 of onboarding sequence).
 */
export async function POST(req: NextRequest) {
  try {
    const { email, name, language } = await req.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400, headers: NO_CACHE });

    const isNl = language !== 'en';
    const firstName = name?.split(' ')[0] || '';

    const subject = isNl
      ? `${firstName}, ontdek wat PayWatch voor je kan doen ✨`
      : `${firstName}, discover what PayWatch can do for you ✨`;

    const featureBlock = (emoji: string, title: string, desc: string) =>
      `<tr><td style="padding:8px 0"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td style="vertical-align:top;padding-right:12px;font-size:22px">${emoji}</td>
        <td><strong style="font-size:13px;color:#0A2540">${title}</strong><br><span style="font-size:12px;color:#64748B">${desc}</span></td>
      </tr></table></td></tr>`;

    const html = emailTemplate({
      preheader: isNl ? 'Rust in je hoofd begint hier.' : 'Peace of mind starts here.',
      heroText: isNl ? 'Rust in je hoofd' : 'Peace of mind',
      heroSubtext: isNl
        ? 'Dit is wat PayWatch voor je kan doen.'
        : 'Here\'s what PayWatch can do for you.',
      body: `
        <p>${isNl ? `Hoi ${firstName},` : `Hey ${firstName},`}</p>
        <p>${isNl
          ? 'Je bent nu 2 dagen onderweg. Hier zijn de functies die het verschil maken:'
          : "You've been with us for 2 days. Here are the features that make the difference:"}</p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0">
          ${isNl ? `
          ${featureBlock('📧', 'Gmail Scanner', 'AI herkent automatisch facturen in je inbox.')}
          ${featureBlock('📸', 'Foto Scanner', 'Scan papieren rekeningen met je camera.')}
          ${featureBlock('🔔', 'Slimme Herinneringen', '3 dagen voor de vervaldatum krijg je een melding.')}
          ${featureBlock('📝', 'Conceptbrieven', 'AI schrijft bezwaar- en betalingsbrieven voor je.')}
          ${featureBlock('🔥', 'Streak Systeem', 'Houd je motivatie vast met op-tijd-betaling streaks.')}
          ${featureBlock('🏆', '20 Prestaties', 'Verdien badges door slim met je geld om te gaan.')}
          ` : `
          ${featureBlock('📧', 'Gmail Scanner', 'AI automatically detects invoices in your inbox.')}
          ${featureBlock('📸', 'Photo Scanner', 'Scan paper bills with your camera.')}
          ${featureBlock('🔔', 'Smart Reminders', 'Get notified 3 days before due dates.')}
          ${featureBlock('📝', 'Draft Letters', 'AI writes dispute and payment plan letters for you.')}
          ${featureBlock('🔥', 'Streak System', 'Stay motivated with on-time payment streaks.')}
          ${featureBlock('🏆', '20 Achievements', 'Earn badges by managing your money wisely.')}
          `}
        </table>

        <p style="margin-top:16px;padding:16px;background:#EFF6FF;border-radius:12px;text-align:center;font-size:13px;color:#2563EB;font-weight:600">
          ${isNl ? '💙 Tip: Koppel je Gmail om automatisch te scannen.' : '💙 Tip: Connect your Gmail for automatic scanning.'}
        </p>
      `,
      ctaText: isNl ? 'Ontdek alle functies' : 'Explore all features',
      ctaUrl: 'https://app.hypesamba.com/overzicht',
    });

    const result = await sendEmail({ to: email, subject, html });
    return NextResponse.json(result, { headers: NO_CACHE });
  } catch (err) {
    console.error('Features email error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
