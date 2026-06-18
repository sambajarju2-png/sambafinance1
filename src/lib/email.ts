/**
 * PayWatch Email System — Resend
 * Lazy initialization to prevent build-time crash when RESEND_API_KEY is not set.
 */

import { generateUnsubscribeUrl } from './unsubscribe';

let resendInstance: import('resend').Resend | null = null;

function getResend() {
  if (!resendInstance) {
    const { Resend } = require('resend');
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance!;
}

const FROM_EMAIL = 'PayWatch <noreply@paywatch.app>';

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

/* ===== LANGUAGE PICKER ===== */
// Picks the right copy for an email language. Falls back to English for
// unknown codes, and to English when a pl/tr string is not provided.
function E(lang: string, o: { nl: string; en: string; pl?: string; tr?: string; fr?: string; ar?: string }): string {
  if (lang === 'nl') return o.nl;
  if (lang === 'pl') return o.pl ?? o.en;
  if (lang === 'tr') return o.tr ?? o.en;
  if (lang === 'fr') return o.fr ?? o.en;
  if (lang === 'ar') return o.ar ?? o.en;
  return o.en;
}

const founderCard = (lang: string) => card(`
  <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${C.purple};text-transform:uppercase;letter-spacing:1px">${E(lang, { nl: 'ONS VERHAAL', en: 'OUR STORY', pl: 'NASZA HISTORIA', tr: 'HİKAYEMİZ', fr: 'NOTRE HISTOIRE', ar: 'قصتنا' })}</p>
  <p style="margin:12px 0;font-size:13px;color:${C.navy};line-height:1.6">${E(lang, {
    nl: 'Paywatch is niet zomaar een app. Het is ontstaan uit onze eigen frustratie. Wij zijn <strong>Samba en Mariama</strong>, de oprichters.',
    en: "Paywatch isn't just an app. It was born out of our own frustration. We're <strong>Samba and Mariama</strong>, the founders.",
    pl: 'Paywatch to nie tylko aplikacja. Powstała z naszej własnej frustracji. Jesteśmy <strong>Samba i Mariama</strong>, założyciele.',
    tr: "Paywatch sadece bir uygulama değil. Kendi hayal kırıklığımızdan doğdu. Biz <strong>Samba ve Mariama</strong>, kurucularız.", fr: "Paywatch n'est pas qu'une application. Elle est née de notre propre frustration. Nous sommes <strong>Samba et Mariama</strong>, les fondateurs.", ar: 'Paywatch ليست مجرد تطبيق. لقد وُلدت من إحباطنا الخاص. نحن <strong>Samba وMariama</strong>، المؤسِّسان.' })}</p>
  <p style="margin:0;font-size:13px;color:${C.muted};line-height:1.6">${E(lang, {
    nl: 'Zelfs toen we onze financien prima op orde hadden, overkwam het ons: een rekening die we simpelweg vergaten. Een brief die onderop de stapel belandde. De stress van een onverwachte aanmaning... we kennen dat gevoel maar al te goed.',
    en: "Even when we were financially okay, it happened to us: a bill we simply forgot. A letter that ended up at the bottom of the pile. The stress of an unexpected reminder... we know that feeling well.",
    pl: 'Nawet kiedy nasze finanse były w porządku, przydarzyło się to i nam: rachunek, o którym po prostu zapomnieliśmy. List, który wylądował na dnie stosu. Stres niespodziewanego ponaglenia... znamy to uczucie aż za dobrze.',
    tr: "Maddi durumumuz iyiyken bile bizim de başımıza geldi: kolayca unuttuğumuz bir fatura. Yığının en altında kalan bir mektup. Beklenmedik bir hatırlatmanın stresi... bu duyguyu çok iyi biliyoruz.", fr: "Même lorsque nos finances allaient bien, cela nous est arrivé : une facture tout simplement oubliée. Une lettre tombée au fond de la pile. Le stress d'un rappel inattendu... nous connaissons bien ce sentiment.", ar: 'حتى عندما كانت أوضاعنا المالية جيدة، حدث لنا ذلك: فاتورة نسيناها ببساطة. رسالة استقرت في قاع الكومة. التوتر من تذكير غير متوقع... نعرف هذا الشعور جيدًا.' })}</p>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px"><tr>
    <td><div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:${C.blue};color:white;text-align:center;line-height:32px;font-size:13px;font-weight:700;margin-right:-4px">S</div><div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:${C.purple};color:white;text-align:center;line-height:32px;font-size:13px;font-weight:700">M</div></td>
    <td style="padding-left:12px"><strong style="font-size:13px;color:${C.navy}">Samba & Mariama</strong><br><span style="font-size:11px;color:${C.muted}">${E(lang, { nl: 'Oprichters van Paywatch', en: 'Founders of Paywatch', pl: 'Założyciele Paywatch', tr: "Paywatch'in kurucuları", fr: 'Fondateurs de Paywatch', ar: 'مؤسِّسا Paywatch' })}</span></td>
  </tr></table>
`);

const footerHtml = (lang: string) => `
  <tr><td style="padding:0 32px"><hr style="border:none;border-top:1px solid ${C.border};margin:0"></td></tr>
  <tr><td style="padding:24px 32px;text-align:center">
    <p style="margin:0;font-size:12px;font-weight:800;color:${C.navy}">PayWatch</p>
    <p style="margin:8px 0 0;font-size:10px;color:${C.muted};line-height:1.5">${E(lang, { nl: 'Gebouwd in Nederland | GDPR/AVG compliant | SOC 2 Type II', en: 'Built in the Netherlands | GDPR compliant | SOC 2 Type II', pl: 'Zbudowane w Holandii | Zgodne z RODO | SOC 2 Type II', tr: "Hollanda'da geliştirildi | GDPR uyumlu | SOC 2 Type II", fr: 'Conçu aux Pays-Bas | Conforme au RGPD | SOC 2 Type II', ar: 'صُنع في هولندا | متوافق مع GDPR | SOC 2 Type II' })}<br>${E(lang, { nl: 'Je gegevens blijven van jou.', en: 'Your data stays yours.', pl: 'Twoje dane pozostają twoje.', tr: 'Verilerin sana ait kalır.', fr: 'Vos données restent les vôtres.', ar: 'بياناتك تبقى ملكك.' })}</p>
  </td></tr>`;

function wrap(content: string, preheader: string = ''): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">${preheader ? `<span style="display:none;font-size:1px;color:#F4F7FB;max-height:0;overflow:hidden">${preheader}</span>` : ''}</head><body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background:${C.surface};border-radius:20px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">${content}</table></td></tr></table></body></html>`;
}

/* ===== EMAIL 1: WELCOME ===== */
export function buildWelcomeEmail(name: string, lang: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || '';
  return {
    subject: E(lang, { nl: 'Je bent niet alleen (en wij snappen het)', en: "You're not alone (and we totally get it)", pl: 'Nie jesteś sam (i my to rozumiemy)', tr: 'Yalnız değilsin (ve bunu çok iyi anlıyoruz)', fr: "Vous n'êtes pas seul (et nous comprenons parfaitement)", ar: 'لست وحدك (ونحن نتفهّم ذلك تمامًا)' }),
    html: wrap(`
      <tr><td style="padding:32px 32px 0;text-align:center"><p style="margin:0;font-size:12px;font-weight:800;color:${C.navy}">PayWatch</p></td></tr>
      <tr><td style="padding:24px 32px 0"><p style="margin:0;font-size:16px;color:${C.blue};font-weight:600">${E(lang, { nl: `Hoi ${firstName},`, en: `Hi ${firstName},`, pl: `Cześć ${firstName},`, tr: `Merhaba ${firstName},` })}</p></td></tr>
      <tr><td style="padding:16px 32px;font-size:14px;color:${C.navy};line-height:1.7">
        <p>${E(lang, {
          nl: 'Welkom bij Paywatch. Het eerste wat we je willen zeggen is dit: <strong>adem in, adem uit. Je staat er niet meer alleen voor.</strong>',
          en: "Welcome to Paywatch. The first thing we want to tell you is this: <strong>breathe in, breathe out. You're not doing this alone anymore.</strong>",
          pl: 'Witaj w Paywatch. Pierwsza rzecz, którą chcemy ci powiedzieć, to: <strong>weź wdech, weź wydech. Nie jesteś już w tym sam.</strong>',
          tr: "Paywatch'e hoş geldin. Sana söylemek istediğimiz ilk şey şu: <strong>nefes al, nefes ver. Artık bunda yalnız değilsin.</strong>", fr: "Bienvenue sur Paywatch. La première chose que nous voulons vous dire est la suivante : <strong>inspirez, expirez. Vous n'êtes plus seul.</strong>", ar: 'مرحبًا بك في Paywatch. أول ما نريد قوله لك هو: <strong>خذ نفسًا، وأخرجه. لم تعد تواجه هذا وحدك.</strong>' })}</p>
        ${founderCard(lang)}
        <p>${E(lang, {
          nl: 'We merkten dat het systeem niet gemaakt is voor mensen die soms wat vergeten — voor mensen die gewoon <em>mens</em> zijn. Daarom zijn we Paywatch gestart.',
          en: "We realized the system isn't built for people who just happen to be human. That's why we started Paywatch.",
          pl: 'Zauważyliśmy, że system nie jest stworzony dla ludzi, którzy czasem o czymś zapominają — dla ludzi, którzy są po prostu <em>ludźmi</em>. Dlatego stworzyliśmy Paywatch.',
          tr: "Sistemin, bazen bir şeyleri unutan insanlar için — sadece <em>insan</em> olan insanlar için yapılmadığını fark ettik. Bu yüzden Paywatch'i kurduk.", fr: "Nous avons réalisé que le système n'est pas fait pour les gens qui sont simplement humains. C'est pourquoi nous avons lancé Paywatch.", ar: 'أدركنا أن النظام ليس مصممًا للأشخاص الذين يكونون ببساطة بشرًا. لهذا أطلقنا Paywatch.' })}</p>
        <p>${E(lang, {
          nl: 'We willen dat niemand zich meer onrustig hoeft te voelen bij het openen van de brievenbus of de inbox. Samen gaan we ervoor zorgen dat die rekeningen je niet meer overvallen.',
          en: "We want to make sure no one ever has to feel that pit in their stomach when opening the mailbox or their inbox again. Together, we'll make sure those bills don't sneak up on you anymore.",
          pl: 'Chcemy, żeby nikt już nie musiał czuć niepokoju przy otwieraniu skrzynki pocztowej czy poczty e-mail. Razem zadbamy o to, żeby te rachunki już cię nie zaskakiwały.',
          tr: 'Hiç kimsenin posta kutusunu ya da gelen kutusunu açarken o huzursuzluğu yaşamasını istemiyoruz. Birlikte, o faturaların seni bir daha gafil avlamamasını sağlayacağız.', fr: 'Nous voulons que plus personne ne ressente cette boule au ventre en ouvrant sa boîte aux lettres ou sa boîte de réception. Ensemble, nous ferons en sorte que ces factures ne vous surprennent plus.', ar: 'نريد ألّا يشعر أحد بعد الآن بتلك الغصّة عند فتح صندوق البريد أو البريد الإلكتروني. معًا، سنحرص على ألّا تباغتك تلك الفواتير مجددًا.' })}</p>
        ${zenBox(E(lang, { nl: '<strong>Jij houdt de regie, wij houden de wacht.</strong>', en: "<strong>You stay in control; we'll keep watch.</strong>", pl: '<strong>Ty masz kontrolę, my czuwamy.</strong>', tr: '<strong>Kontrol sende, nöbeti biz tutarız.</strong>', fr: '<strong>Vous gardez le contrôle ; nous montons la garde.</strong>', ar: '<strong>أنت تتحكّم، ونحن نراقب.</strong>' }))}
      </td></tr>
      <tr><td style="padding:0 32px 8px">${btn(E(lang, { nl: 'Start je eerste scan', en: 'Start your first scan', pl: 'Rozpocznij pierwsze skanowanie', tr: 'İlk taramanı başlat', fr: 'Lancer votre premier scan', ar: 'ابدأ أول فحص لك' }), 'https://app.paywatch.app/overzicht')}</td></tr>
      <tr><td style="padding:0 32px 32px;text-align:center"><p style="margin:0;font-size:13px;color:${C.muted}">${E(lang, { nl: 'Welkom bij de familie,', en: 'Welcome to the family,', pl: 'Witaj w rodzinie,', tr: 'Aileye hoş geldin,', fr: 'Bienvenue dans la famille,', ar: 'مرحبًا بك في العائلة،' })}<br><strong style="color:${C.navy}">Samba & Mariama</strong></p></td></tr>
      ${footerHtml(lang)}
    `, E(lang, { nl: 'Adem in, adem uit. Je staat er niet meer alleen voor.', en: "Breathe in, breathe out. You're not doing this alone anymore.", pl: 'Weź wdech, weź wydech. Nie jesteś już w tym sam.', tr: 'Nefes al, nefes ver. Artık bunda yalnız değilsin.', fr: "Inspirez, expirez. Vous n'êtes plus seul.", ar: 'خذ نفسًا، وأخرجه. لم تعد تواجه هذا وحدك.' }))
  };
}

/* ===== EMAIL 2: FEATURES (Day 2) ===== */
export function buildFeaturesEmail(name: string, lang: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || '';
  return {
    subject: E(lang, { nl: 'Rust in je hoofd: zo werkt Paywatch', en: 'Peace of mind: how Paywatch works for you', pl: 'Spokój w głowie: tak działa Paywatch', tr: 'Kafan rahat olsun: Paywatch nasıl çalışır', fr: 'La sérénité : comment Paywatch travaille pour vous', ar: 'راحة البال: كيف يعمل Paywatch من أجلك' }),
    html: wrap(`
      <tr><td style="padding:0"><div style="background:linear-gradient(135deg,#EFF6FF,#F0FDF4);padding:40px 32px;text-align:center">
        <p style="margin:0;font-size:12px;font-weight:800;color:${C.navy}">PayWatch</p>
        <p style="margin:16px 0 0;font-size:24px;font-weight:800;color:${C.navy};font-style:italic">${E(lang, { nl: 'Rust in je hoofd', en: 'Peace of mind', pl: 'Spokój w głowie', tr: 'Kafan rahat', fr: 'La sérénité', ar: 'راحة البال' })}</p>
      </div></td></tr>
      <tr><td style="padding:24px 32px 0"><p style="margin:0;font-size:16px;color:${C.blue};font-weight:600">${E(lang, { nl: `Hoi ${firstName},`, en: `Hi ${firstName},`, pl: `Cześć ${firstName},`, tr: `Merhaba ${firstName},` })}</p></td></tr>
      <tr><td style="padding:16px 32px;font-size:14px;color:${C.navy};line-height:1.7">
        <p>${E(lang, { nl: 'Twee dagen geleden zeiden we het al: we gaan dit samen doen. Vandaag laten we je zien hoe Paywatch jouw digitale bodyguard wordt.', en: "Two days ago, we promised we'd do this together. Today, we want to show you exactly how Paywatch becomes your digital bodyguard.", pl: 'Dwa dni temu obiecaliśmy: zrobimy to razem. Dziś pokażemy ci, jak Paywatch staje się twoim cyfrowym ochroniarzem.', tr: 'İki gün önce söz vermiştik: bunu birlikte yapacağız. Bugün, Paywatch\'in dijital korumana nasıl dönüştüğünü göstereceğiz.', fr: "Il y a deux jours, nous avons promis de faire cela ensemble. Aujourd'hui, nous voulons vous montrer exactement comment Paywatch devient votre garde du corps numérique.", ar: 'قبل يومين، وعدنا بأن نفعل هذا معًا. اليوم، نريد أن نُريك كيف يصبح Paywatch حارسك الرقمي الشخصي.' })}</p>
        <p style="font-size:18px;font-weight:800;color:${C.navy};margin:20px 0 8px">${E(lang, { nl: 'Wat kun je verwachten?', en: "What's in it for you?", pl: 'Czego możesz się spodziewać?', tr: 'Seni neler bekliyor?', fr: "Qu'est-ce que vous y gagnez ?", ar: 'ماذا ستجني من ذلك؟' })}</p>
        ${featureCard('#EFF6FF', E(lang, { nl: 'Geen verrassingen meer', en: 'No more surprises', pl: 'Koniec z niespodziankami', tr: 'Artık sürpriz yok', fr: 'Fini les surprises', ar: 'لا مزيد من المفاجآت' }), E(lang, { nl: 'Upload je rekening en wij vertellen je precies in welke fase je zit — van factuur tot deurwaarder. Altijd het volledige overzicht.', en: "Upload your bill, and we'll tell you exactly what stage it's in — from a simple invoice to a bailiff notice.", pl: 'Prześlij rachunek, a powiemy ci dokładnie, na jakim etapie jesteś — od faktury po komornika. Zawsze pełny obraz.', tr: 'Faturanı yükle, sana tam olarak hangi aşamada olduğunu söyleyelim — faturadan icra memuruna kadar. Her zaman tam görünüm.', fr: "Téléchargez votre facture et nous vous dirons exactement à quelle phase elle se trouve — de la simple facture à l'avis d'huissier.", ar: 'حمّل فاتورتك وسنخبرك بالضبط في أي مرحلة هي — من فاتورة بسيطة إلى إشعار المحضر.' }))}
        ${featureCard('#F0FDF4', E(lang, { nl: 'Lokale hulp binnen handbereik', en: 'Local help at your fingertips', pl: 'Lokalna pomoc w zasięgu ręki', tr: 'Yerel yardım parmaklarının ucunda', fr: 'Une aide locale à portée de main', ar: 'مساعدة محلية في متناول يدك' }), E(lang, { nl: 'Woon je bijvoorbeeld in Rotterdam? Wij koppelen je direct aan organisaties zoals Nieuw Vaarwater of je lokale kredietbank als het even te veel wordt.', en: "Living in Rotterdam? We'll link you directly to organizations like Nieuw Vaarwater or your local credit bank if things get overwhelming.", pl: 'Mieszkasz na przykład w Rotterdamie? Jeśli zrobi się zbyt ciężko, połączymy cię bezpośrednio z organizacjami jak Nieuw Vaarwater lub twoim lokalnym bankiem kredytowym.', tr: 'Örneğin Rotterdam\'da mı yaşıyorsun? İşler zorlaşırsa seni doğrudan Nieuw Vaarwater gibi kuruluşlara ya da yerel kredi bankana bağlarız.', fr: 'Vous habitez à Rotterdam ? Si la situation devient trop lourde, nous vous mettons directement en relation avec des organisations comme Nieuw Vaarwater ou votre banque de crédit locale.', ar: 'تسكن في روتردام؟ إذا أصبح الأمر مرهقًا، سنربطك مباشرةً بمنظمات مثل Nieuw Vaarwater أو بنك الائتمان المحلي لديك.' }))}
        ${featureCard('#FDF4FF', E(lang, { nl: 'Slimme matching', en: 'Smart matching', pl: 'Inteligentne dopasowanie', tr: 'Akıllı eşleştirme', fr: 'Association intelligente', ar: 'مطابقة ذكية' }), E(lang, { nl: 'Wij herkennen of die nieuwe aanmaning bij die oude factuur hoort, zodat jij altijd het overzicht houdt. Geen gedoe meer met losse papieren.', en: 'We recognize if that new reminder belongs to an old invoice, so you always have the full picture.', pl: 'Rozpoznajemy, czy nowe ponaglenie należy do starej faktury, żebyś zawsze miał pełny obraz. Koniec z bałaganem luźnych papierów.', tr: 'Yeni gelen hatırlatmanın eski bir faturaya ait olup olmadığını tanırız, böylece her zaman tam görünüme sahip olursun. Dağınık kâğıtlarla uğraşmak yok.', fr: "Nous reconnaissons si ce nouveau rappel correspond à une ancienne facture, pour que vous gardiez toujours une vue d'ensemble.", ar: 'نتعرّف على ما إذا كان التذكير الجديد يخصّ فاتورة قديمة، حتى تبقى لديك دائمًا الصورة الكاملة.' }))}
        ${zenBox(E(lang, { nl: 'Het doel? Dat jij je weer kunt focussen op wat echt belangrijk is, zonder die constante "cloud" van onbetaalde rekeningen boven je hoofd.', en: 'The goal? To let you focus on what truly matters, without that constant "cloud" of unpaid bills hanging over your head.', pl: 'Cel? Żebyś znów mógł skupić się na tym, co naprawdę ważne, bez tej ciągłej "chmury" nieopłaconych rachunków nad głową.', tr: 'Amaç? Başının üstünde sürekli duran o ödenmemiş faturalar "bulutu" olmadan, gerçekten önemli olana yeniden odaklanabilmen.', fr: "L'objectif ? Vous permettre de vous concentrer sur ce qui compte vraiment, sans ce « nuage » constant de factures impayées au-dessus de votre tête.", ar: 'الهدف؟ أن تتمكّن من التركيز على ما يهم حقًا، دون تلك "السحابة" الدائمة من الفواتير غير المدفوعة فوق رأسك.' }))}
      </td></tr>
      <tr><td style="padding:0 32px 8px">${btn(E(lang, { nl: 'Open de App', en: 'Open the App', pl: 'Otwórz aplikację', tr: 'Uygulamayı aç', fr: "Ouvrir l'application", ar: 'افتح التطبيق' }), 'https://app.paywatch.app/overzicht')}</td></tr>
      <tr><td style="padding:0 32px 32px;text-align:center"><p style="margin:0;font-size:13px;color:${C.muted}">${E(lang, { nl: 'Geniet van je dag,', en: 'Have a great day,', pl: 'Miłego dnia,', tr: 'İyi günler,', fr: 'Belle journée,', ar: 'نتمنى لك يومًا رائعًا،' })}<br><strong style="color:${C.navy}">Samba & Mariama</strong></p></td></tr>
      ${footerHtml(lang)}
    `, E(lang, { nl: 'Rust in je hoofd begint hier.', en: 'Peace of mind starts here.', pl: 'Spokój w głowie zaczyna się tutaj.', tr: 'Kafa rahatlığı burada başlar.', fr: 'La sérénité commence ici.', ar: 'راحة البال تبدأ من هنا.' }))
  };
}

/* ===== EMAIL 3: WEEKLY DIGEST ===== */
export function buildDigestEmail(name: string, lang: string, stats: {
  outstanding: number; overdue: number; paid_this_week: number; streak: number;
  total_outstanding_cents: number; next_due_vendor: string | null; next_due_date: string | null;
}, userId?: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || '';
  const total = `€${((stats?.total_outstanding_cents || 0) / 100).toFixed(2).replace('.', ',')}`;

  // Generate unsubscribe link for this user (only if userId is provided)
  let unsubscribeHtml = '';
  if (userId) {
    try {
      const url = generateUnsubscribeUrl(userId, lang);
      unsubscribeHtml = `<tr><td style="padding:0 32px 24px;text-align:center"><p style="margin:0;font-size:11px;color:#94A3B8">${E(lang, { nl: 'Je ontvangt deze e-mail omdat je een PayWatch account hebt.', en: "You're receiving this email because you have a PayWatch account.", pl: 'Otrzymujesz tę wiadomość, ponieważ masz konto PayWatch.', tr: "Bu e-postayı bir PayWatch hesabın olduğu için alıyorsun.", fr: 'Vous recevez cet e-mail parce que vous avez un compte PayWatch.', ar: 'تتلقى هذا البريد لأن لديك حساب PayWatch.' })}<br><a href="${url}" style="color:#94A3B8;text-decoration:underline">${E(lang, { nl: 'Uitschrijven voor wekelijkse e-mails', en: 'Unsubscribe from weekly emails', pl: 'Wypisz się z cotygodniowych e-maili', tr: 'Haftalık e-postalardan çık', fr: 'Se désabonner des e-mails hebdomadaires', ar: 'إلغاء الاشتراك في الرسائل الأسبوعية' })}</a></p></td></tr>`;
    } catch {
      // If token generation fails, skip unsubscribe link silently
    }
  }

  return {
    subject: E(lang, { nl: 'Jouw Paywatch Check-in: Lekker bezig!', en: "Your Paywatch Check-in: You've got this!", pl: 'Twoje podsumowanie Paywatch: Dobra robota!', tr: 'Paywatch özetin: Harika gidiyorsun!', fr: 'Votre point Paywatch : vous gérez !', ar: 'متابعتك مع Paywatch: أنت قادر على ذلك!' }),
    html: wrap(`
      <tr><td style="padding:32px 32px 0;text-align:center"><p style="margin:0;font-size:12px;font-weight:800;color:${C.navy}">PayWatch</p></td></tr>
      <tr><td style="padding:20px 32px 0"><p style="margin:0;font-size:20px;font-weight:800;color:${C.navy}">${E(lang, { nl: `Hoi ${firstName}`, en: `Hey ${firstName}`, pl: `Cześć ${firstName}`, tr: `Merhaba ${firstName}` })}</p><p style="margin:6px 0 0;font-size:14px;color:${C.muted}">${E(lang, { nl: 'Tijd voor je wekelijkse momentje van rust. Even een korte blik op hoe je ervoor staat.', en: "Time for your weekly moment of calm. Just a quick look at where things stand.", pl: 'Czas na twoją cotygodniową chwilę spokoju. Krótkie spojrzenie na to, jak stoisz.', tr: 'Haftalık sakinlik anının zamanı. Durumuna kısaca bir göz atalım.', fr: "C'est l'heure de votre moment de calme hebdomadaire. Un rapide coup d'œil sur la situation.", ar: 'حان وقت لحظة الهدوء الأسبوعية. نظرة سريعة على وضعك.' })}</p></td></tr>
      <tr><td style="padding:16px 32px;font-size:14px;color:${C.navy};line-height:1.7">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>${statCard(E(lang, { nl: 'Openstaand', en: 'Outstanding', pl: 'Otwarte', tr: 'Açık', fr: 'En cours', ar: 'مستحقة' }), String(stats?.outstanding || 0), C.navy)}${statCard(E(lang, { nl: 'Achterstallig', en: 'Overdue', pl: 'Zaległe', tr: 'Gecikmiş', fr: 'En retard', ar: 'متأخرة' }), String(stats?.overdue || 0), (stats?.overdue || 0) > 0 ? C.red : C.green)}</tr>
          <tr>${statCard(E(lang, { nl: 'Betaald deze week', en: 'Paid this week', pl: 'Zapłacone w tym tygodniu', tr: 'Bu hafta ödenen', fr: 'Payé cette semaine', ar: 'المدفوع هذا الأسبوع' }), String(stats?.paid_this_week || 0), C.green)}${statCard('Streak', String(stats?.streak || 0), C.blue)}</tr>
          <tr>${statCard(E(lang, { nl: 'Totaal openstaand', en: 'Total outstanding', pl: 'Łącznie otwarte', tr: 'Toplam açık', fr: 'Total en cours', ar: 'إجمالي المستحق' }), total, C.navy)}${statCard(E(lang, { nl: 'Volgende', en: 'Next due', pl: 'Następne', tr: 'Sıradaki', fr: 'Prochaine échéance', ar: 'التالي استحقاقًا' }), stats?.next_due_vendor || '—', C.purple)}</tr>
        </table>
        ${(stats?.overdue || 0) > 0
          ? card(`<p style="margin:0;font-size:13px;color:${C.red};font-weight:600">${E(lang, {
              nl: `Je hebt ${stats.overdue} achterstallige rekening${stats.overdue > 1 ? 'en' : ''}. Open de app om actie te nemen.`,
              en: `You have ${stats.overdue} overdue bill${stats.overdue > 1 ? 's' : ''}. Open the app to take action.`,
              pl: `Liczba zaległych rachunków: ${stats.overdue}. Otwórz aplikację, aby podjąć działanie.`,
              tr: `${stats.overdue} gecikmiş faturan var. İşlem yapmak için uygulamayı aç.`,
            })}</p>`, C.red + '30')
          : card(`<p style="margin:0;font-size:13px;color:${C.green};font-weight:600">${E(lang, { nl: 'Geen achterstallige rekeningen. Goed bezig!', en: 'No overdue bills. Great job!', pl: 'Brak zaległych rachunków. Świetna robota!', tr: 'Gecikmiş fatura yok. Aferin!', fr: 'Aucune facture en retard. Bravo !', ar: 'لا فواتير متأخرة. أحسنت!' })}</p>`, C.green + '30')}
        ${card(`<p style="margin:0 0 6px;font-size:11px;font-weight:600;color:${C.blue};text-transform:uppercase;letter-spacing:1px">${E(lang, { nl: 'WIST JE DAT?', en: 'DID YOU KNOW?', pl: 'CZY WIESZ, ŻE?', tr: 'BİLİYOR MUYDUN?', fr: 'LE SAVIEZ-VOUS ?', ar: 'هل تعلم؟' })}</p><p style="margin:0;font-size:13px;color:${C.navy};line-height:1.6">${E(lang, { nl: "In Nederland heb je vaak recht op een '14-dagen brief' voordat er incassokosten in rekening mogen worden gebracht. Heb je er een ontvangen? Upload hem direct, dan checken wij of de kosten wel kloppen!", en: 'In the Netherlands, you are usually entitled to a "14-day letter" before any collection fees can be charged. Did you receive one? Upload it immediately, and we\'ll check if the fees are legally correct!', pl: 'W Holandii zwykle przysługuje ci "list 14-dniowy" (14-dagen brief), zanim mogą zostać naliczone koszty windykacji. Dostałeś taki? Prześlij go od razu, a sprawdzimy, czy koszty się zgadzają!', tr: "Hollanda'da, herhangi bir tahsilat masrafı eklenebilmeden önce genellikle bir '14 günlük mektup' (14-dagen brief) hakkın vardır. Böyle bir mektup aldın mı? Hemen yükle, masrafların doğru olup olmadığını kontrol edelim!", fr: 'Aux Pays-Bas, vous avez généralement droit à une « lettre de 14 jours » (14-dagen brief) avant que des frais de recouvrement ne puissent être facturés. Vous en avez reçu une ? Téléchargez-la tout de suite et nous vérifierons si les frais sont corrects !', ar: 'في هولندا، يحق لك عادةً الحصول على "خطاب 14 يومًا" (14-dagen brief) قبل أن يُسمح بفرض رسوم تحصيل. هل تلقّيت واحدًا؟ حمّله فورًا وسنتحقّق مما إذا كانت الرسوم صحيحة!' })}</p>`)}
        ${zenBox(`<em>"${E(lang, { nl: 'Geld is een hulpmiddel, geen meester.', en: 'Money is a tool, not a master.', pl: 'Pieniądze są narzędziem, nie panem.', tr: 'Para bir araçtır, efendi değil.', fr: "L'argent est un outil, pas un maître.", ar: 'المال أداة، وليس سيدًا.' })}"</em><br><span style="font-size:12px;color:${C.muted}">${E(lang, { nl: 'Neem vandaag 5 minuten voor jezelf. Je hebt je zaken onder controle.', en: 'Take 5 minutes for yourself today. You are in control.', pl: 'Poświęć dziś 5 minut dla siebie. Masz swoje sprawy pod kontrolą.', tr: 'Bugün kendine 5 dakika ayır. İşlerin kontrolü sende.', fr: "Prenez 5 minutes pour vous aujourd'hui. Vous avez la situation en main.", ar: 'خذ 5 دقائق لنفسك اليوم. الأمور تحت سيطرتك.' })}</span>`)}
      </td></tr>
      <tr><td style="padding:0 32px 8px">${btn(E(lang, { nl: 'Bekijk je overzicht', en: 'View your overview', pl: 'Zobacz swoje podsumowanie', tr: 'Genel görünümünü gör', fr: 'Voir votre aperçu', ar: 'عرض ملخصك' }), 'https://app.paywatch.app/overzicht')}</td></tr>
      <tr><td style="padding:0 32px 32px;text-align:center"><p style="margin:0;font-size:13px;color:${C.muted}">${E(lang, { nl: 'Tot volgende week!', en: 'See you next week!', pl: 'Do zobaczenia w przyszłym tygodniu!', tr: 'Gelecek hafta görüşürüz!', fr: 'À la semaine prochaine !', ar: 'إلى اللقاء الأسبوع المقبل!' })}<br><strong style="color:${C.navy}">Samba & Mariama</strong></p></td></tr>
      ${footerHtml(lang)}
      ${unsubscribeHtml}
    `, E(lang, { nl: 'Je wekelijkse overzicht staat klaar.', en: 'Your weekly overview is ready.', pl: 'Twoje cotygodniowe podsumowanie jest gotowe.', tr: 'Haftalık genel görünümün hazır.', fr: 'Votre aperçu hebdomadaire est prêt.', ar: 'ملخصك الأسبوعي جاهز.' }))
  };
}
