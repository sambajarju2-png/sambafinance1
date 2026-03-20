/**
 * PayWatch Email System — Resend
 * Lazy initialization to prevent build-time crash when RESEND_API_KEY is not set.
 */

let resendInstance: import('resend').Resend | null = null;

function getResend() {
  if (!resendInstance) {
    const { Resend } = require('resend');
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance!;
}

const FROM_EMAIL = 'PayWatch <noreply@email.paywatch.app';

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to: params.to, subject: params.subject, html: params.html });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Email error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown' };
  }
}

/* ===== COLORS ===== */
const C = { navy: '#0A2540', blue: '#2563EB', green: '#059669', red: '#DC2626', muted: '#64748B', border: '#E2E8F0', bg: '#F4F7FB', surface: '#FFFFFF', purple: '#7C3AED' };

/* ===== HELPERS ===== */
const card = (content: string, border: string = C.border) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0;border:1px solid ${border};border-radius:16px;overflow:hidden;background:${C.surface}"><tr><td style="padding:20px 24px">${content}</td></tr></table>`;

const featureCard = (bgColor: string, title: string, desc: string) =>
  card(`<strong style="font-size:14px;color:${C.navy};display:block;margin-bottom:6px">${title}</strong><span style="font-size:13px;color:${C.muted};line-height:1.6">${desc}</span>`, bgColor);

const statCard = (label: string, value: string, color: string) =>
  `<td style="padding:6px;width:50%"><div style="background:${C.bg};border-radius:12px;padding:14px 12px;text-align:center"><p style="margin:0;font-size:22px;font-weight:800;color:${color}">${value}</p><p style="margin:4px 0 0;font-size:11px;color:${C.muted}">${label}</p></div></td>`;

const btn = (text: string, url: string) =>
  `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto"><tr><td style="background:${C.blue};border-radius:50px;box-shadow:0 4px 14px rgba(37,99,235,0.2)"><a href="${url}" style="display:inline-block;padding:14px 36px;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none">${text}</a></td></tr></table>`;

const zenBox = (text: string) =>
  `<div style="margin:20px 0;padding:20px;background:linear-gradient(135deg,#EFF6FF,#F0FDF4);border-radius:16px;text-align:center"><p style="margin:0;font-size:14px;color:${C.navy};font-weight:600;line-height:1.5">${text}</p></div>`;

const founderCard = (isNl: boolean) => card(`
  <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${C.purple};text-transform:uppercase;letter-spacing:1px">${isNl ? 'ONS VERHAAL' : 'OUR STORY'}</p>
  <p style="margin:12px 0;font-size:13px;color:${C.navy};line-height:1.6">${isNl
    ? 'Paywatch is niet zomaar een app. Het is ontstaan uit onze eigen frustratie. Wij zijn <strong>Samba en Mariama</strong>, de oprichters.'
    : "Paywatch isn't just an app. It was born out of our own frustration. We're <strong>Samba and Mariama</strong>, the founders."}</p>
  <p style="margin:0;font-size:13px;color:${C.muted};line-height:1.6">${isNl
    ? 'Zelfs toen we onze financien prima op orde hadden, overkwam het ons: een rekening die we simpelweg vergaten. Een brief die onderop de stapel belandde. De stress van een onverwachte aanmaning... we kennen dat gevoel maar al te goed.'
    : "Even when we were financially okay, it happened to us: a bill we simply forgot. A letter that ended up at the bottom of the pile. The stress of an unexpected reminder... we know that feeling well."}</p>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px"><tr>
    <td><div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:${C.blue};color:white;text-align:center;line-height:32px;font-size:13px;font-weight:700;margin-right:-4px">S</div><div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:${C.purple};color:white;text-align:center;line-height:32px;font-size:13px;font-weight:700">M</div></td>
    <td style="padding-left:12px"><strong style="font-size:13px;color:${C.navy}">Samba & Mariama</strong><br><span style="font-size:11px;color:${C.muted}">${isNl ? 'Oprichters van Paywatch' : 'Founders of Paywatch'}</span></td>
  </tr></table>
`);

const footerHtml = (isNl: boolean) => `
  <tr><td style="padding:0 32px"><hr style="border:none;border-top:1px solid ${C.border};margin:0"></td></tr>
  <tr><td style="padding:24px 32px;text-align:center">
    <p style="margin:0;font-size:12px;font-weight:800;color:${C.navy}">PayWatch</p>
    <p style="margin:8px 0 0;font-size:10px;color:${C.muted};line-height:1.5">${isNl ? 'Gebouwd in Nederland | GDPR/AVG compliant | SOC 2 Type II' : 'Built in the Netherlands | GDPR compliant | SOC 2 Type II'}<br>${isNl ? 'Je gegevens blijven van jou.' : 'Your data stays yours.'}</p>
  </td></tr>`;

function wrap(content: string, preheader: string = ''): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">${preheader ? `<span style="display:none;font-size:1px;color:#F4F7FB;max-height:0;overflow:hidden">${preheader}</span>` : ''}</head><body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background:${C.surface};border-radius:20px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">${content}</table></td></tr></table></body></html>`;
}

/* ===== EMAIL 1: WELCOME ===== */
export function buildWelcomeEmail(name: string, isNl: boolean): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || '';
  return {
    subject: isNl ? 'Je bent niet alleen (en wij snappen het)' : "You're not alone (and we totally get it)",
    html: wrap(`
      <tr><td style="padding:32px 32px 0;text-align:center"><p style="margin:0;font-size:12px;font-weight:800;color:${C.navy}">PayWatch</p></td></tr>
      <tr><td style="padding:24px 32px 0"><p style="margin:0;font-size:16px;color:${C.blue};font-weight:600">${isNl ? `Hoi ${firstName},` : `Hi ${firstName},`}</p></td></tr>
      <tr><td style="padding:16px 32px;font-size:14px;color:${C.navy};line-height:1.7">
        <p>${isNl
          ? 'Welkom bij Paywatch. Het eerste wat we je willen zeggen is dit: <strong>adem in, adem uit. Je staat er niet meer alleen voor.</strong>'
          : "Welcome to Paywatch. The first thing we want to tell you is this: <strong>breathe in, breathe out. You're not doing this alone anymore.</strong>"}</p>
        ${founderCard(isNl)}
        <p>${isNl
          ? 'We merkten dat het systeem niet gemaakt is voor mensen die soms wat vergeten — voor mensen die gewoon <em>mens</em> zijn. Daarom zijn we Paywatch gestart.'
          : "We realized the system isn't built for people who just happen to be human. That's why we started Paywatch."}</p>
        <p>${isNl
          ? 'We willen dat niemand zich meer onrustig hoeft te voelen bij het openen van de brievenbus of de inbox. Samen gaan we ervoor zorgen dat die rekeningen je niet meer overvallen.'
          : "We want to make sure no one ever has to feel that pit in their stomach when opening the mailbox or their inbox again. Together, we'll make sure those bills don't sneak up on you anymore."}</p>
        ${zenBox(isNl ? '<strong>Jij houdt de regie, wij houden de wacht.</strong>' : "<strong>You stay in control; we'll keep watch.</strong>")}
      </td></tr>
      <tr><td style="padding:0 32px 8px">${btn(isNl ? 'Start je eerste scan' : 'Start your first scan', 'https://app.paywatch.app/overzicht')}</td></tr>
      <tr><td style="padding:0 32px 32px;text-align:center"><p style="margin:0;font-size:13px;color:${C.muted}">${isNl ? 'Welkom bij de familie,' : 'Welcome to the family,'}<br><strong style="color:${C.navy}">Samba & Mariama</strong></p></td></tr>
      ${footerHtml(isNl)}
    `, isNl ? 'Adem in, adem uit. Je staat er niet meer alleen voor.' : "Breathe in, breathe out. You're not doing this alone anymore.")
  };
}

/* ===== EMAIL 2: FEATURES (Day 2) ===== */
export function buildFeaturesEmail(name: string, isNl: boolean): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || '';
  return {
    subject: isNl ? 'Rust in je hoofd: zo werkt Paywatch' : 'Peace of mind: how Paywatch works for you',
    html: wrap(`
      <tr><td style="padding:0"><div style="background:linear-gradient(135deg,#EFF6FF,#F0FDF4);padding:40px 32px;text-align:center">
        <p style="margin:0;font-size:12px;font-weight:800;color:${C.navy}">PayWatch</p>
        <p style="margin:16px 0 0;font-size:24px;font-weight:800;color:${C.navy};font-style:italic">${isNl ? 'Rust in je hoofd' : 'Peace of mind'}</p>
      </div></td></tr>
      <tr><td style="padding:24px 32px 0"><p style="margin:0;font-size:16px;color:${C.blue};font-weight:600">${isNl ? `Hoi ${firstName},` : `Hi ${firstName},`}</p></td></tr>
      <tr><td style="padding:16px 32px;font-size:14px;color:${C.navy};line-height:1.7">
        <p>${isNl ? 'Twee dagen geleden zeiden we het al: we gaan dit samen doen. Vandaag laten we je zien hoe Paywatch jouw digitale bodyguard wordt.' : "Two days ago, we promised we'd do this together. Today, we want to show you exactly how Paywatch becomes your digital bodyguard."}</p>
        <p style="font-size:18px;font-weight:800;color:${C.navy};margin:20px 0 8px">${isNl ? 'Wat kun je verwachten?' : "What's in it for you?"}</p>
        ${featureCard('#EFF6FF', isNl ? 'Geen verrassingen meer' : 'No more surprises', isNl ? 'Upload je rekening en wij vertellen je precies in welke fase je zit — van factuur tot deurwaarder. Altijd het volledige overzicht.' : "Upload your bill, and we'll tell you exactly what stage it's in — from a simple invoice to a bailiff notice.")}
        ${featureCard('#F0FDF4', isNl ? 'Lokale hulp binnen handbereik' : 'Local help at your fingertips', isNl ? 'Woon je bijvoorbeeld in Rotterdam? Wij koppelen je direct aan organisaties zoals Nieuw Vaarwater of je lokale kredietbank als het even te veel wordt.' : "Living in Rotterdam? We'll link you directly to organizations like Nieuw Vaarwater or your local credit bank if things get overwhelming.")}
        ${featureCard('#FDF4FF', isNl ? 'Slimme matching' : 'Smart matching', isNl ? 'Wij herkennen of die nieuwe aanmaning bij die oude factuur hoort, zodat jij altijd het overzicht houdt. Geen gedoe meer met losse papieren.' : 'We recognize if that new reminder belongs to an old invoice, so you always have the full picture.')}
        ${zenBox(isNl ? 'Het doel? Dat jij je weer kunt focussen op wat echt belangrijk is, zonder die constante "cloud" van onbetaalde rekeningen boven je hoofd.' : 'The goal? To let you focus on what truly matters, without that constant "cloud" of unpaid bills hanging over your head.')}
      </td></tr>
      <tr><td style="padding:0 32px 8px">${btn(isNl ? 'Open de App' : 'Open the App', 'https://app.paywatch.app/overzicht')}</td></tr>
      <tr><td style="padding:0 32px 32px;text-align:center"><p style="margin:0;font-size:13px;color:${C.muted}">${isNl ? 'Geniet van je dag,' : 'Have a great day,'}<br><strong style="color:${C.navy}">Samba & Mariama</strong></p></td></tr>
      ${footerHtml(isNl)}
    `, isNl ? 'Rust in je hoofd begint hier.' : 'Peace of mind starts here.')
  };
}

/* ===== EMAIL 3: WEEKLY DIGEST ===== */
export function buildDigestEmail(name: string, isNl: boolean, stats: {
  outstanding: number; overdue: number; paid_this_week: number; streak: number;
  total_outstanding_cents: number; next_due_vendor: string | null; next_due_date: string | null;
}): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || '';
  const total = `€${((stats?.total_outstanding_cents || 0) / 100).toFixed(2).replace('.', ',')}`;
  return {
    subject: isNl ? 'Jouw Paywatch Check-in: Lekker bezig!' : "Your Paywatch Check-in: You've got this!",
    html: wrap(`
      <tr><td style="padding:32px 32px 0;text-align:center"><p style="margin:0;font-size:12px;font-weight:800;color:${C.navy}">PayWatch</p></td></tr>
      <tr><td style="padding:20px 32px 0"><p style="margin:0;font-size:20px;font-weight:800;color:${C.navy}">${isNl ? `Hoi ${firstName}` : `Hey ${firstName}`}</p><p style="margin:6px 0 0;font-size:14px;color:${C.muted}">${isNl ? 'Tijd voor je wekelijkse momentje van rust. Even een korte blik op hoe je ervoor staat.' : "Time for your weekly moment of calm. Just a quick look at where things stand."}</p></td></tr>
      <tr><td style="padding:16px 32px;font-size:14px;color:${C.navy};line-height:1.7">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>${statCard(isNl ? 'Openstaand' : 'Outstanding', String(stats?.outstanding || 0), C.navy)}${statCard(isNl ? 'Achterstallig' : 'Overdue', String(stats?.overdue || 0), (stats?.overdue || 0) > 0 ? C.red : C.green)}</tr>
          <tr>${statCard(isNl ? 'Betaald deze week' : 'Paid this week', String(stats?.paid_this_week || 0), C.green)}${statCard('Streak', String(stats?.streak || 0), C.blue)}</tr>
          <tr>${statCard(isNl ? 'Totaal openstaand' : 'Total outstanding', total, C.navy)}${statCard(isNl ? 'Volgende' : 'Next due', stats?.next_due_vendor || '—', C.purple)}</tr>
        </table>
        ${(stats?.overdue || 0) > 0
          ? card(`<p style="margin:0;font-size:13px;color:${C.red};font-weight:600">${isNl ? `Je hebt ${stats.overdue} achterstallige rekening${stats.overdue > 1 ? 'en' : ''}. Open de app om actie te nemen.` : `You have ${stats.overdue} overdue bill${stats.overdue > 1 ? 's' : ''}. Open the app to take action.`}</p>`, C.red + '30')
          : card(`<p style="margin:0;font-size:13px;color:${C.green};font-weight:600">${isNl ? 'Geen achterstallige rekeningen. Goed bezig!' : 'No overdue bills. Great job!'}</p>`, C.green + '30')}
        ${card(`<p style="margin:0 0 6px;font-size:11px;font-weight:600;color:${C.blue};text-transform:uppercase;letter-spacing:1px">${isNl ? 'WIST JE DAT?' : 'DID YOU KNOW?'}</p><p style="margin:0;font-size:13px;color:${C.navy};line-height:1.6">${isNl ? "In Nederland heb je vaak recht op een '14-dagen brief' voordat er incassokosten in rekening mogen worden gebracht. Heb je er een ontvangen? Upload hem direct, dan checken wij of de kosten wel kloppen!" : 'In the Netherlands, you are usually entitled to a "14-day letter" before any collection fees can be charged. Did you receive one? Upload it immediately, and we\'ll check if the fees are legally correct!'}</p>`)}
        ${zenBox(`<em>"${isNl ? 'Geld is een hulpmiddel, geen meester.' : 'Money is a tool, not a master.'}"</em><br><span style="font-size:12px;color:${C.muted}">${isNl ? 'Neem vandaag 5 minuten voor jezelf. Je hebt je zaken onder controle.' : 'Take 5 minutes for yourself today. You are in control.'}</span>`)}
      </td></tr>
      <tr><td style="padding:0 32px 8px">${btn(isNl ? 'Bekijk je overzicht' : 'View your overview', 'https://app.paywatch.app/overzicht')}</td></tr>
      <tr><td style="padding:0 32px 32px;text-align:center"><p style="margin:0;font-size:13px;color:${C.muted}">${isNl ? 'Tot volgende week!' : 'See you next week!'}<br><strong style="color:${C.navy}">Samba & Mariama</strong></p></td></tr>
      ${footerHtml(isNl)}
    `, isNl ? 'Je wekelijkse overzicht staat klaar.' : 'Your weekly overview is ready.')
  };
}
