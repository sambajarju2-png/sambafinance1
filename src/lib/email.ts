import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'PayWatch <noreply@hypesamba.com>';

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to: params.to, subject: params.subject, html: params.html });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Email error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown' };
  }
}

/* ===== SHARED STYLES ===== */
const COLORS = { navy: '#0A2540', blue: '#2563EB', green: '#059669', red: '#DC2626', muted: '#64748B', border: '#E2E8F0', bg: '#F4F7FB', surface: '#FFFFFF', purple: '#7C3AED' };

const card = (content: string, borderColor: string = COLORS.border) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0;border:1px solid ${borderColor};border-radius:16px;overflow:hidden;background:${COLORS.surface}"><tr><td style="padding:20px 24px">${content}</td></tr></table>`;

const featureCard = (emoji: string, bgColor: string, title: string, desc: string) =>
  card(`<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="vertical-align:top;padding-right:14px"><div style="width:44px;height:44px;border-radius:12px;background:${bgColor};text-align:center;line-height:44px;font-size:20px">${emoji}</div></td><td><strong style="font-size:14px;color:${COLORS.navy};display:block;margin-bottom:4px">${title}</strong><span style="font-size:13px;color:${COLORS.muted};line-height:1.5">${desc}</span></td></tr></table>`);

const statCard = (label: string, value: string, color: string) =>
  `<td style="padding:8px;text-align:center;width:50%"><div style="background:${COLORS.bg};border-radius:12px;padding:16px 12px"><p style="margin:0;font-size:24px;font-weight:800;color:${color}">${value}</p><p style="margin:4px 0 0;font-size:11px;color:${COLORS.muted}">${label}</p></div></td>`;

const btn = (text: string, url: string, bg: string = COLORS.blue) =>
  `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto"><tr><td style="background:${bg};border-radius:50px;box-shadow:0 4px 14px rgba(37,99,235,0.2)"><a href="${url}" style="display:inline-block;padding:14px 36px;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">${text}</a></td></tr></table>`;

const divider = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0"><tr><td style="text-align:center"><span style="font-size:16px">🌿</span></td></tr></table>`;

const founderSig = (isNl: boolean) =>
  card(`<p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${COLORS.purple};text-transform:uppercase;letter-spacing:1px">💜 ${isNl ? 'ONS VERHAAL' : 'OUR STORY'}</p><p style="margin:12px 0;font-size:13px;color:${COLORS.navy};line-height:1.6">${isNl ? 'Paywatch is niet zomaar een app. Het is ontstaan uit onze eigen frustratie. Wij zijn <strong>Samba en Mariama</strong>, de oprichters.' : "Paywatch isn't just an app — it was born from our own frustration. We're <strong>Samba and Mariama</strong>, the founders."}</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px"><tr><td><div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:${COLORS.blue};color:white;text-align:center;line-height:32px;font-size:13px;font-weight:700;margin-right:-6px">S</div><div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:${COLORS.purple};color:white;text-align:center;line-height:32px;font-size:13px;font-weight:700">M</div></td><td style="padding-left:12px"><strong style="font-size:13px;color:${COLORS.navy}">Samba & Mariama</strong><br><span style="font-size:11px;color:${COLORS.muted}">${isNl ? 'Oprichters van Paywatch' : 'Founders of Paywatch'}</span></td></tr></table>`, COLORS.border);

const zenBox = (text: string) =>
  `<div style="margin:20px 0;padding:20px;background:linear-gradient(135deg,#EFF6FF,#F0FDF4);border-radius:16px;text-align:center"><p style="margin:0;font-size:14px;color:${COLORS.navy};font-weight:600;line-height:1.5">${text}</p></div>`;

const footer = (isNl: boolean) =>
  `<tr><td style="padding:0 32px"><hr style="border:none;border-top:1px solid ${COLORS.border};margin:0"></td></tr><tr><td style="padding:24px 32px;text-align:center"><table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td style="font-size:12px;font-weight:800;color:${COLORS.navy};letter-spacing:-0.3px">🛡️ PayWatch</td></tr></table><p style="margin:8px 0 0;font-size:10px;color:${COLORS.muted};line-height:1.5">${isNl ? 'Gebouwd in Nederland 🇳🇱 • GDPR/AVG compliant • SOC 2 Type II' : 'Built in the Netherlands 🇳🇱 • GDPR compliant • SOC 2 Type II'}<br>${isNl ? 'Je gegevens blijven van jou.' : 'Your data stays yours.'}</p></td></tr>`;

function wrap(content: string, preheader: string = ''): string {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">${preheader ? `<span style="display:none;font-size:1px;color:#F4F7FB;max-height:0;overflow:hidden">${preheader}</span>` : ''}</head><body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background:${COLORS.surface};border-radius:20px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">${content}</table></td></tr></table></body></html>`;
}

/* ===== EMAIL BUILDERS ===== */

export function buildWelcomeEmail(name: string, isNl: boolean): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || '';
  const subject = isNl ? `Je bent niet alleen (en wij snappen het) 🌿` : `You're not alone (and we totally get it) 🌿`;

  const html = wrap(`
    <tr><td style="padding:32px 32px 0;text-align:center"><span style="font-size:12px;font-weight:800;color:${COLORS.navy};letter-spacing:-0.3px">🛡️ PayWatch</span></td></tr>
    <tr><td style="padding:24px 32px 0"><p style="margin:0;font-size:16px;color:${COLORS.blue};font-weight:600">${isNl ? `Hoi ${firstName},` : `Hi ${firstName},`}</p></td></tr>
    <tr><td style="padding:16px 32px;font-size:14px;color:${COLORS.navy};line-height:1.7">
      <p>${isNl ? `Welkom bij Paywatch. Het eerste wat we je willen zeggen is dit: <strong>adem in, adem uit. Je staat er niet meer alleen voor.</strong>` : `Welcome to Paywatch. The first thing we want to tell you is this: <strong>breathe in, breathe out. You're not doing this alone anymore.</strong>`}</p>
      <p>${isNl ? `Meer dan 1,6 miljoen Nederlanders hebben moeite met het bijhouden van rekeningen. En eerlijk? Het overkwam ons ook: een rekening die we simpelweg vergaten. Een brief die onderop de stapel belandde. De stress van een onverwachte aanmaning... we kennen dat gevoel maar al te goed.` : `More than 1.6 million people in the Netherlands struggle to keep up with bills. And honestly? It happened to us too: a bill we simply forgot. A letter that ended up at the bottom of the pile. The stress of an unexpected reminder... we know that feeling well.`}</p>
      ${founderSig(isNl)}
      <p>${isNl ? `We merkten dat het systeem niet gemaakt is voor mensen die soms wat vergeten — voor mensen die gewoon <em>mens</em> zijn. Daarom zijn we Paywatch gestart.` : `We realized the system isn't built for people who just happen to be human. That's why we started Paywatch.`}</p>
      <p>${isNl ? `We willen dat niemand zich meer onrustig hoeft te voelen bij het openen van de brievenbus of de inbox. Samen gaan we ervoor zorgen dat die rekeningen je niet meer overvallen.` : `We want to make sure no one ever has to feel that "pit in their stomach" when opening the mailbox or their inbox again. Together, we'll make sure those bills don't sneak up on you anymore.`}</p>
      ${zenBox(isNl ? '<strong>Jij houdt de regie, wij houden de wacht.</strong> 🌿' : '<strong>You stay in control; we\'ll keep watch.</strong> 🌿')}
    </td></tr>
    <tr><td style="padding:0 32px 32px;text-align:center">${btn(isNl ? 'Start je eerste scan' : 'Start your first scan', 'https://app.hypesamba.com/overzicht')}</td></tr>
    ${footer(isNl)}
  `, isNl ? 'Adem in, adem uit. Je staat er niet meer alleen voor.' : "Breathe in, breathe out. You're not doing this alone anymore.");

  return { subject, html };
}

export function buildFeaturesEmail(name: string, isNl: boolean): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || '';
  const subject = isNl ? `Rust in je hoofd: zo werkt Paywatch ✨` : `Peace of mind: how Paywatch works for you ✨`;

  const html = wrap(`
    <tr><td style="padding:0"><div style="background:linear-gradient(135deg,#EFF6FF 0%,#F0FDF4 100%);padding:40px 32px;text-align:center"><span style="font-size:12px;font-weight:800;color:${COLORS.navy};letter-spacing:-0.3px">🛡️ PayWatch</span><p style="margin:16px 0 0;font-size:22px;font-weight:800;color:${COLORS.navy};font-style:italic;letter-spacing:-0.5px">${isNl ? 'Rust in je hoofd' : 'Peace of mind'}</p><p style="margin:4px 0 0;font-size:12px;color:${COLORS.muted}">📱 PayWatch App</p></div></td></tr>
    <tr><td style="padding:24px 32px 0"><p style="margin:0;font-size:16px;color:${COLORS.blue};font-weight:600">${isNl ? `Hoi ${firstName},` : `Hi ${firstName},`}</p></td></tr>
    <tr><td style="padding:16px 32px;font-size:14px;color:${COLORS.navy};line-height:1.7">
      <p>${isNl ? 'Twee dagen geleden zeiden we het al: we gaan dit samen doen. Vandaag laten we je zien hoe Paywatch jouw digitale bodyguard wordt.' : "Two days ago, we promised we'd do this together. Today, we want to show you exactly how Paywatch becomes your digital bodyguard."}</p>
      <p style="font-size:18px;font-weight:800;color:${COLORS.navy};margin:20px 0 8px">${isNl ? 'Wat kun je verwachten?' : "What's in it for you?"}</p>
      ${featureCard('🔍', '#EFF6FF', isNl ? 'Geen verrassingen meer' : 'No more surprises', isNl ? 'Upload je rekening en wij vertellen je precies in welke fase je zit — van factuur tot deurwaarder. Altijd het volledige overzicht.' : "Upload your bill, and we'll tell you exactly what stage it's in — from a simple invoice to a bailiff notice.")}
      ${featureCard('📍', '#F0FDF4', isNl ? 'Lokale hulp binnen handbereik' : 'Local help at your fingertips', isNl ? 'Woon je bijvoorbeeld in Rotterdam? Wij koppelen je direct aan organisaties zoals Nieuw Vaarwater of je lokale kredietbank als het even te veel wordt.' : "Living in Rotterdam? We'll link you directly to organizations like Nieuw Vaarwater or your local credit bank if things get overwhelming.")}
      ${featureCard('🧩', '#FDF4FF', isNl ? 'Slimme matching' : 'Smart matching', isNl ? 'Wij herkennen of die nieuwe aanmaning bij die oude factuur hoort, zodat jij altijd het overzicht houdt. Geen gedoe meer met losse papieren.' : 'We recognize if that new reminder belongs to an old invoice, so you always have the full picture.')}
      ${divider}
      ${zenBox(isNl ? 'Het doel? Dat jij je weer kunt focussen op wat écht belangrijk is, zonder die constante "cloud" van onbetaalde rekeningen boven je hoofd.' : 'The goal? To let you focus on what truly matters, without that constant "cloud" of unpaid bills hanging over your head.')}
    </td></tr>
    <tr><td style="padding:0 32px 32px;text-align:center">${btn(isNl ? 'Open de App' : 'Open the App', 'https://app.hypesamba.com/overzicht')}<p style="margin:8px 0 0;font-size:12px;color:${COLORS.muted}">${isNl ? 'Geniet van je dag,' : 'Have a great day,'}<br><strong>Samba & Mariama</strong></p></td></tr>
    ${footer(isNl)}
  `, isNl ? 'Rust in je hoofd begint hier.' : 'Peace of mind starts here.');

  return { subject, html };
}

export function buildDigestEmail(name: string, isNl: boolean, stats: {
  outstanding: number; overdue: number; paid_this_week: number; streak: number;
  total_outstanding_cents: number; next_due_vendor: string | null; next_due_date: string | null;
}): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || '';
  const subject = isNl ? `Jouw Paywatch Check-in: Lekker bezig! ☕️` : `Your Paywatch Check-in: You've got this! ☕️`;
  const totalFormatted = `€${(stats.total_outstanding_cents / 100).toFixed(2).replace('.', ',')}`;

  const html = wrap(`
    <tr><td style="padding:32px 32px 0;text-align:center"><span style="font-size:12px;font-weight:800;color:${COLORS.navy}">🛡️ PayWatch</span></td></tr>
    <tr><td style="padding:20px 32px 0"><p style="margin:0;font-size:20px;font-weight:800;color:${COLORS.navy}">${isNl ? `Hoi ${firstName} 👋` : `Hey ${firstName} 👋`}</p><p style="margin:6px 0 0;font-size:14px;color:${COLORS.muted}">${isNl ? 'Tijd voor je wekelijkse momentje van rust.' : 'Time for your weekly moment of calm.'}</p></td></tr>
    <tr><td style="padding:20px 32px;font-size:14px;color:${COLORS.navy};line-height:1.7">
      <!-- Stats grid -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>${statCard(isNl ? 'Openstaand' : 'Outstanding', String(stats.outstanding), COLORS.navy)}${statCard(isNl ? 'Achterstallig' : 'Overdue', String(stats.overdue), stats.overdue > 0 ? COLORS.red : COLORS.green)}</tr>
        <tr>${statCard(isNl ? 'Betaald deze week' : 'Paid this week', String(stats.paid_this_week), COLORS.green)}${statCard('Streak', `🔥 ${stats.streak}`, COLORS.blue)}</tr>
        <tr>${statCard(isNl ? 'Totaal openstaand' : 'Total outstanding', totalFormatted, COLORS.navy)}${statCard(isNl ? 'Volgende vervaldatum' : 'Next due', stats.next_due_vendor ? `${stats.next_due_vendor}` : '—', COLORS.purple)}</tr>
      </table>

      ${stats.overdue > 0 ? card(`<p style="margin:0;font-size:13px;color:${COLORS.red};font-weight:600">⚠️ ${isNl ? `Je hebt ${stats.overdue} achterstallige rekening${stats.overdue > 1 ? 'en' : ''}. Open de app om actie te nemen.` : `You have ${stats.overdue} overdue bill${stats.overdue > 1 ? 's' : ''}. Open the app to take action.`}</p>`, COLORS.red + '40') : card(`<p style="margin:0;font-size:13px;color:${COLORS.green};font-weight:600">✅ ${isNl ? 'Geen achterstallige rekeningen. Goed bezig!' : 'No overdue bills. Great job!'}</p>`, COLORS.green + '40')}

      ${card(`<p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${COLORS.blue};text-transform:uppercase;letter-spacing:1px">💡 ${isNl ? 'WIST JE DAT?' : 'DID YOU KNOW?'}</p><p style="margin:0;font-size:13px;color:${COLORS.navy};line-height:1.6">${isNl ? 'In Nederland heb je vaak recht op een \'14-dagen brief\' voordat er incassokosten in rekening mogen worden gebracht. Heb je er een ontvangen? Upload hem direct, dan checken wij of de kosten wel kloppen!' : "In the Netherlands, you are usually entitled to a \"14-day letter\" before any collection fees can be charged. Did you receive one? Upload it immediately, and we'll check if the fees are legally correct!"}</p>`)}

      ${zenBox(`<span style="font-style:italic">"${isNl ? 'Geld is een hulpmiddel, geen meester.' : 'Money is a tool, not a master.'}"</span><br><span style="font-size:12px;color:${COLORS.muted}">${isNl ? 'Neem vandaag 5 minuten voor jezelf. Je hebt je zaken onder controle.' : 'Take 5 minutes for yourself today. You are in control.'}</span>`)}
    </td></tr>
    <tr><td style="padding:0 32px 32px;text-align:center">${btn(isNl ? 'Bekijk je overzicht' : 'View your overview', 'https://app.hypesamba.com/overzicht')}<p style="margin:8px 0 0;font-size:12px;color:${COLORS.muted}">${isNl ? 'Tot volgende week!' : 'See you next week!'}<br><strong>Samba & Mariama</strong></p></td></tr>
    ${footer(isNl)}
  `, isNl ? 'Even een korte blik op hoe je ervoor staat.' : 'Just a quick look at where things stand.');

  return { subject, html };
}
