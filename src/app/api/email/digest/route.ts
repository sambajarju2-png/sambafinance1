import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, emailTemplate } from '@/lib/email';
import { formatCents } from '@/lib/bills';

const NO_CACHE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/email/digest
 * Body: { email, name, language, stats: { outstanding, overdue, paid_this_week, streak, next_due_vendor, next_due_date, total_outstanding_cents } }
 * Sends a weekly digest email.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, name, language, stats } = await req.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400, headers: NO_CACHE });

    const isNl = language !== 'en';
    const firstName = name?.split(' ')[0] || '';

    const subject = isNl
      ? `Je wekelijkse overzicht 📊`
      : `Your weekly overview 📊`;

    const statRow = (label: string, value: string, color: string = '#0A2540') =>
      `<tr>
        <td style="padding:8px 0;font-size:13px;color:#64748B">${label}</td>
        <td style="padding:8px 0;font-size:14px;font-weight:700;color:${color};text-align:right">${value}</td>
      </tr>`;

    const html = emailTemplate({
      preheader: isNl ? `${stats?.outstanding || 0} openstaande rekeningen deze week.` : `${stats?.outstanding || 0} outstanding bills this week.`,
      heroText: isNl ? `Hoi ${firstName} 👋` : `Hey ${firstName} 👋`,
      heroSubtext: isNl ? 'Hier is je wekelijkse overzicht.' : "Here's your weekly overview.",
      body: `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:16px">
          <tr><td style="padding:16px;background:#F8FAFB">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              ${isNl ? `
              ${statRow('Openstaand', String(stats?.outstanding || 0))}
              ${statRow('Achterstallig', String(stats?.overdue || 0), stats?.overdue > 0 ? '#DC2626' : '#059669')}
              ${statRow('Betaald deze week', String(stats?.paid_this_week || 0), '#059669')}
              ${statRow('Totaal openstaand', formatCents(stats?.total_outstanding_cents || 0))}
              ${statRow('Streak', `🔥 ${stats?.streak || 0}`, '#2563EB')}
              ` : `
              ${statRow('Outstanding', String(stats?.outstanding || 0))}
              ${statRow('Overdue', String(stats?.overdue || 0), stats?.overdue > 0 ? '#DC2626' : '#059669')}
              ${statRow('Paid this week', String(stats?.paid_this_week || 0), '#059669')}
              ${statRow('Total outstanding', formatCents(stats?.total_outstanding_cents || 0))}
              ${statRow('Streak', `🔥 ${stats?.streak || 0}`, '#2563EB')}
              `}
            </table>
          </td></tr>
        </table>

        ${stats?.next_due_vendor ? `
        <p style="padding:12px 16px;background:#FEF3C7;border-radius:12px;font-size:13px;color:#92400E;font-weight:600">
          ⏰ ${isNl
            ? `Volgende vervaldatum: <strong>${stats.next_due_vendor}</strong> op ${stats.next_due_date}`
            : `Next due: <strong>${stats.next_due_vendor}</strong> on ${stats.next_due_date}`}
        </p>` : ''}

        ${stats?.overdue > 0 ? `
        <p style="margin-top:12px;padding:12px 16px;background:#FEF2F2;border-radius:12px;font-size:13px;color:#DC2626;font-weight:600">
          ⚠️ ${isNl
            ? `Je hebt ${stats.overdue} achterstallige rekening${stats.overdue > 1 ? 'en' : ''}. Open de app om actie te nemen.`
            : `You have ${stats.overdue} overdue bill${stats.overdue > 1 ? 's' : ''}. Open the app to take action.`}
        </p>` : `
        <p style="margin-top:12px;padding:12px 16px;background:#F0FDF4;border-radius:12px;font-size:13px;color:#059669;font-weight:600">
          ✅ ${isNl ? 'Geen achterstallige rekeningen. Goed bezig!' : 'No overdue bills. Great job!'}
        </p>`}
      `,
      ctaText: isNl ? 'Bekijk je overzicht' : 'View your overview',
      ctaUrl: 'https://app.hypesamba.com/overzicht',
    });

    const result = await sendEmail({ to: email, subject, html });
    return NextResponse.json(result, { headers: NO_CACHE });
  } catch (err) {
    console.error('Digest email error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_CACHE });
  }
}
