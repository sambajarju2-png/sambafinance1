/**
 * Run ONCE: node scripts/add-step43-translations.js
 * Adds tour, feedback, and updated PWA drawer translations
 */
const fs = require('fs');
const path = require('path');

function update(filePath, isNl) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Tour translations
  content.tour = {
    skip: isNl ? 'Overslaan' : 'Skip',
    next: isNl ? 'Volgende' : 'Next',
    getStarted: isNl ? 'Aan de slag' : "Let's go",
    overview: {
      title: isNl ? 'Overzicht' : 'Overview',
      desc: isNl ? 'Je dashboard. Hier zie je in een oogopslag al je openstaande rekeningen, achterstallige betalingen en bespaarde incassokosten.' : 'Your dashboard. See all your outstanding bills, overdue payments and saved collection costs at a glance.',
    },
    payments: {
      title: isNl ? 'Betalingen' : 'Payments',
      desc: isNl ? 'Alle rekeningen op een rij. Filter op openstaand, aankomend, achterstallig of betaald. Tik op een rekening voor details en acties.' : 'All your bills in one place. Filter by outstanding, upcoming, overdue or paid. Tap a bill for details and actions.',
    },
    stats: {
      title: isNl ? 'Statistieken' : 'Statistics',
      desc: isNl ? 'Grafieken en AI-inzichten. Bekijk je bestedingspatronen en ontvang persoonlijk financieel advies.' : 'Charts and AI insights. View your spending patterns and receive personalized financial advice.',
    },
    cashflow: {
      title: isNl ? 'Cashflow' : 'Cashflow',
      desc: isNl ? 'Maandelijks overzicht van je inkomsten en uitgaven. Zie in een oogopslag of je op schema ligt.' : 'Monthly overview of your income and expenses. See at a glance if you are on track.',
    },
    settings: {
      title: isNl ? 'Instellingen' : 'Settings',
      desc: isNl ? 'Profiel, Gmail koppeling, meldingen, prestaties, budget en hulpbronnen. Alles op een plek.' : 'Profile, Gmail connection, notifications, achievements, budget and help resources. All in one place.',
    },
  };

  // Feedback translations
  content.feedback = {
    title: isNl ? 'Hoe bevalt PayWatch?' : 'How do you like PayWatch?',
    desc: isNl ? 'Je gebruikt de app nu een paar dagen. We horen graag wat je ervan vindt.' : "You've been using the app for a few days. We'd love to hear what you think.",
    placeholder: isNl ? 'Vertel ons wat je vindt... (optioneel)' : 'Tell us what you think... (optional)',
    submit: isNl ? 'Verstuur' : 'Submit',
    later: isNl ? 'Later' : 'Later',
    thankYouTitle: isNl ? 'Bedankt!' : 'Thank you!',
    thankYouDesc: isNl ? 'Je feedback helpt ons PayWatch beter te maken voor iedereen.' : 'Your feedback helps us make PayWatch better for everyone.',
  };

  // Updated PWA translations (install drawer with step-by-step)
  content.pwa = {
    installTitle: isNl ? 'Installeer PayWatch' : 'Install PayWatch',
    installDesc: isNl ? 'Voeg PayWatch toe aan je startscherm' : 'Add PayWatch to your home screen',
    install: isNl ? 'Installeren' : 'Install',
    maybeLater: isNl ? 'Misschien later' : 'Maybe later',
    iosStep1Title: isNl ? "Tik op 'Deel'" : "Tap 'Share'",
    iosStep1Desc: isNl ? "Tik onderaan op het deel-icoon (vierkant met pijl omhoog)." : "Tap the share icon at the bottom (square with arrow up).",
    iosStep2Title: isNl ? "'Zet op beginscherm'" : "'Add to Home Screen'",
    iosStep2Desc: isNl ? "Scroll naar beneden en tik op 'Zet op beginscherm'." : "Scroll down and tap 'Add to Home Screen'.",
    iosStep3Title: isNl ? 'Klaar!' : 'Done!',
    iosStep3Desc: isNl ? 'PayWatch staat nu op je startscherm als een echte app.' : 'PayWatch is now on your home screen like a real app.',
    androidStep1Title: isNl ? 'Open het menu' : 'Open the menu',
    androidStep1Desc: isNl ? 'Tik op de drie puntjes rechtsboven in je browser.' : 'Tap the three dots in the top right of your browser.',
    androidStep2Title: isNl ? "'Installeren' of 'Toevoegen'" : "'Install' or 'Add to home screen'",
    androidStep2Desc: isNl ? "Tik op 'App installeren' of 'Toevoegen aan startscherm'." : "Tap 'Install app' or 'Add to home screen'.",
    androidStep3Title: isNl ? 'Klaar!' : 'Done!',
    androidStep3Desc: isNl ? 'PayWatch staat nu op je startscherm als een echte app.' : 'PayWatch is now on your home screen like a real app.',
  };

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  console.log('Updated:', filePath);
}

update(path.join(__dirname, '..', 'src', 'messages', 'nl.json'), true);
update(path.join(__dirname, '..', 'src', 'messages', 'en.json'), false);
console.log('Done! Tour, feedback, and PWA translations added.');
