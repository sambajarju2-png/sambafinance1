/**
 * Run ONCE: node scripts/add-step43-translations.js
 * Deep merges tour, feedback, and updated PWA translations into existing JSON.
 * Does NOT overwrite existing keys — only adds missing ones.
 */
const fs = require('fs');
const path = require('path');

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else if (!(key in target)) {
      target[key] = source[key];
    }
  }
  return target;
}

function addKeys(filePath, newKeys) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  deepMerge(content, newKeys);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  console.log('Updated:', filePath);
}

const NL = {
  tour: {
    skip: 'Overslaan',
    next: 'Volgende',
    getStarted: 'Aan de slag',
    overview: { title: 'Overzicht', desc: 'Je dashboard. Hier zie je in een oogopslag al je openstaande rekeningen, achterstallige betalingen en bespaarde incassokosten.' },
    payments: { title: 'Betalingen', desc: 'Alle rekeningen op een rij. Filter op openstaand, aankomend, achterstallig of betaald. Tik op een rekening voor details en acties.' },
    stats: { title: 'Statistieken', desc: 'Grafieken en AI-inzichten. Bekijk je bestedingspatronen en ontvang persoonlijk financieel advies.' },
    cashflow: { title: 'Cashflow', desc: 'Maandelijks overzicht van je inkomsten en uitgaven. Zie in een oogopslag of je op schema ligt.' },
    settings: { title: 'Instellingen', desc: 'Profiel, Gmail koppeling, meldingen, prestaties, budget en hulpbronnen. Alles op een plek.' },
  },
  feedback: {
    title: 'Hoe bevalt PayWatch?',
    desc: 'Je gebruikt de app nu een paar dagen. We horen graag wat je ervan vindt.',
    placeholder: 'Vertel ons wat je vindt... (optioneel)',
    submit: 'Verstuur',
    later: 'Later',
    thankYouTitle: 'Bedankt!',
    thankYouDesc: 'Je feedback helpt ons PayWatch beter te maken voor iedereen.',
  },
  pwa: {
    installTitle: 'Installeer PayWatch',
    installDesc: 'Voeg PayWatch toe aan je startscherm',
    install: 'Installeren',
    maybeLater: 'Misschien later',
    iosStep1Title: "Tik op 'Deel'",
    iosStep1Desc: 'Tik onderaan op het deel-icoon (vierkant met pijl omhoog).',
    iosStep2Title: "'Zet op beginscherm'",
    iosStep2Desc: "Scroll naar beneden en tik op 'Zet op beginscherm'.",
    iosStep3Title: 'Klaar!',
    iosStep3Desc: 'PayWatch staat nu op je startscherm als een echte app.',
    androidStep1Title: 'Open het menu',
    androidStep1Desc: 'Tik op de drie puntjes rechtsboven in je browser.',
    androidStep2Title: "'Installeren' of 'Toevoegen'",
    androidStep2Desc: "Tik op 'App installeren' of 'Toevoegen aan startscherm'.",
    androidStep3Title: 'Klaar!',
    androidStep3Desc: 'PayWatch staat nu op je startscherm als een echte app.',
  },
  adminTest: {
    title: 'Test functies (admin)',
    triggerTour: 'Start app tour',
    triggerFeedback: 'Toon feedback popup',
    triggerPwa: 'Toon PWA drawer',
    tourReset: 'Tour gereset',
    feedbackReset: 'Feedback gereset',
    pwaReset: 'PWA drawer gereset',
  },
};

const EN = {
  tour: {
    skip: 'Skip',
    next: 'Next',
    getStarted: "Let's go",
    overview: { title: 'Overview', desc: 'Your dashboard. See all your outstanding bills, overdue payments and saved collection costs at a glance.' },
    payments: { title: 'Payments', desc: 'All your bills in one place. Filter by outstanding, upcoming, overdue or paid. Tap a bill for details and actions.' },
    stats: { title: 'Statistics', desc: 'Charts and AI insights. View your spending patterns and receive personalized financial advice.' },
    cashflow: { title: 'Cashflow', desc: 'Monthly overview of your income and expenses. See at a glance if you are on track.' },
    settings: { title: 'Settings', desc: 'Profile, Gmail connection, notifications, achievements, budget and help resources. All in one place.' },
  },
  feedback: {
    title: 'How do you like PayWatch?',
    desc: "You've been using the app for a few days. We'd love to hear what you think.",
    placeholder: 'Tell us what you think... (optional)',
    submit: 'Submit',
    later: 'Later',
    thankYouTitle: 'Thank you!',
    thankYouDesc: 'Your feedback helps us make PayWatch better for everyone.',
  },
  pwa: {
    installTitle: 'Install PayWatch',
    installDesc: 'Add PayWatch to your home screen',
    install: 'Install',
    maybeLater: 'Maybe later',
    iosStep1Title: "Tap 'Share'",
    iosStep1Desc: 'Tap the share icon at the bottom (square with arrow up).',
    iosStep2Title: "'Add to Home Screen'",
    iosStep2Desc: "Scroll down and tap 'Add to Home Screen'.",
    iosStep3Title: 'Done!',
    iosStep3Desc: 'PayWatch is now on your home screen like a real app.',
    androidStep1Title: 'Open the menu',
    androidStep1Desc: 'Tap the three dots in the top right of your browser.',
    androidStep2Title: "'Install' or 'Add to home screen'",
    androidStep2Desc: "Tap 'Install app' or 'Add to home screen'.",
    androidStep3Title: 'Done!',
    androidStep3Desc: 'PayWatch is now on your home screen like a real app.',
  },
  adminTest: {
    title: 'Test features (admin)',
    triggerTour: 'Start app tour',
    triggerFeedback: 'Show feedback popup',
    triggerPwa: 'Show PWA drawer',
    tourReset: 'Tour reset',
    feedbackReset: 'Feedback reset',
    pwaReset: 'PWA drawer reset',
  },
};

const nlPath = path.join(__dirname, '..', 'src', 'messages', 'nl.json');
const enPath = path.join(__dirname, '..', 'src', 'messages', 'en.json');
addKeys(nlPath, NL);
addKeys(enPath, EN);
console.log('Done! Tour, feedback, PWA, and admin test translations merged.');
