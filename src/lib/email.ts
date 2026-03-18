import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'PayWatch <noreply@hypesamba.com>';

/**
 * Send an email via Resend.
 * SERVER-ONLY.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown' };
  }
}

/**
 * HTML email wrapper with PayWatch house style.
 */
export function emailTemplate(params: {
  preheader?: string;
  heroText?: string;
  heroSubtext?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${params.preheader ? `<span style="display:none;font-size:1px;color:#F8FAFB;max-height:0;overflow:hidden">${params.preheader}</span>` : ''}
</head>
<body style="margin:0;padding:0;background-color:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">

        <!-- Header with logo -->
        <tr><td style="padding:28px 32px 0;text-align:center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
            <tr>
              <td style="background-color:#0A2540;width:36px;height:36px;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;color:white">🛡</td>
              <td style="padding-left:10px;font-size:18px;font-weight:800;color:#0A2540;letter-spacing:-0.5px">PayWatch</td>
            </tr>
          </table>
        </td></tr>

        ${params.heroText ? `
        <!-- Hero -->
        <tr><td style="padding:32px 32px 8px;text-align:center">
          <h1 style="margin:0;font-size:26px;font-weight:800;color:#0A2540;line-height:1.15;letter-spacing:-0.5px">${params.heroText}</h1>
          ${params.heroSubtext ? `<p style="margin:12px 0 0;font-size:15px;color:#64748B;line-height:1.5">${params.heroSubtext}</p>` : ''}
        </td></tr>` : ''}

        <!-- Body -->
        <tr><td style="padding:24px 32px;font-size:14px;color:#0F172A;line-height:1.7">
          ${params.body}
        </td></tr>

        ${params.ctaText && params.ctaUrl ? `
        <!-- CTA -->
        <tr><td style="padding:0 32px 32px;text-align:center">
          <a href="${params.ctaUrl}" style="display:inline-block;padding:14px 32px;background-color:#2563EB;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:50px;box-shadow:0 4px 12px rgba(37,99,235,0.25)">
            ${params.ctaText}
          </a>
        </td></tr>` : ''}

        <!-- Divider -->
        <tr><td style="padding:0 32px"><hr style="border:none;border-top:1px solid #E2E8F0;margin:0"></td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;text-align:center;font-size:11px;color:#94A3B8;line-height:1.5">
          ${params.footer || 'PayWatch — Rust in je hoofd over elke rekening.<br>Je gegevens blijven van jou.'}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
