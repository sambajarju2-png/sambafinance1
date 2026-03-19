/**
 * Run ONCE after unzipping: node scripts/add-translations.js
 * Adds achievement, mood, escalation stage, and settings translations to nl.json and en.json
 */
const fs = require('fs');
const path = require('path');

const NL_ACHIEVEMENTS = {
  title: 'Prestaties',
  categories: { betalingen: 'Betalingen', streak: 'Streak', gezondheid: 'Financiële gezondheid', gebruik: 'App gebruik' },
  howToTitle: 'Hoe verdien je prestaties?',
  moreToUnlock: 'meer te ontgrendelen',
  unlockedOn: 'Ontgrendeld op',
  locked: 'Nog niet ontgrendeld',
  howToUnlock: 'Hoe ontgrendel je dit?',
  items: {
    eerste_betaling: { name: 'Eerste Stap', desc: 'Je eerste rekening betaald', howTo: 'Markeer je eerste rekening als betaald.' },
    vijf_betaald: { name: 'Op Dreef', desc: '5 rekeningen betaald', howTo: 'Betaal in totaal 5 rekeningen.' },
    tien_betaald: { name: 'Doorzetter', desc: '10 rekeningen betaald', howTo: 'Betaal in totaal 10 rekeningen.' },
    twintig_betaald: { name: 'Meester Betaler', desc: '20 rekeningen betaald', howTo: 'Betaal in totaal 20 rekeningen.' },
    vijftig_betaald: { name: 'Legende', desc: '50 rekeningen betaald', howTo: 'Betaal in totaal 50 rekeningen.' },
    streak_3: { name: 'Drietal', desc: '3 op tijd achter elkaar', howTo: 'Betaal 3 rekeningen op tijd achter elkaar.' },
    streak_5: { name: 'Vijfklapper', desc: '5 op tijd achter elkaar', howTo: 'Betaal 5 rekeningen op tijd achter elkaar.' },
    streak_10: { name: 'Kampioen', desc: '10 op tijd achter elkaar', howTo: 'Betaal 10 rekeningen op tijd achter elkaar.' },
    streak_20: { name: 'Onstopbaar', desc: '20 op tijd achter elkaar', howTo: 'Betaal 20 rekeningen op tijd achter elkaar.' },
    nul_achterstallig: { name: 'Schoon Bord', desc: 'Geen achterstallige rekeningen', howTo: 'Zorg dat je geen achterstallige rekeningen hebt.' },
    alle_betaald: { name: 'Schuldenvrij', desc: 'Alle rekeningen betaald', howTo: 'Betaal al je openstaande rekeningen.' },
    bespaard_100: { name: 'Spaarpot', desc: '€100 incassokosten bespaard', howTo: 'Bespaar €100 door op tijd te betalen.' },
    bespaard_500: { name: 'Geldwijs', desc: '€500 incassokosten bespaard', howTo: 'Bespaar €500 door op tijd te betalen.' },
    scanner: { name: 'Scanner', desc: 'Eerste foto scan', howTo: 'Scan een rekening met je camera.' },
    gmail_koppeling: { name: 'Verbonden', desc: 'Gmail gekoppeld', howTo: 'Koppel je Gmail in Instellingen.' },
    brief_geschreven: { name: 'Woordvoerder', desc: 'Eerste conceptbrief', howTo: 'Schrijf een conceptbrief via een rekening.' },
    gemeente_ingesteld: { name: 'Lokale Held', desc: 'Gemeente ingesteld', howTo: 'Stel je gemeente in via Profiel.' },
    donkere_modus: { name: 'Nachtbraker', desc: 'Donkere modus aan', howTo: 'Schakel donkere modus in.' },
    meldingen_aan: { name: 'Op De Hoogte', desc: 'Meldingen ingeschakeld', howTo: 'Schakel pushmeldingen in.' },
    mood_gelogd: { name: 'Gevoelsmens', desc: 'Stemming gelogd', howTo: 'Log je stemming op het dashboard.' },
  },
};

const EN_ACHIEVEMENTS = {
  title: 'Achievements',
  categories: { betalingen: 'Payments', streak: 'Streak', gezondheid: 'Financial Health', gebruik: 'App Usage' },
  howToTitle: 'How to earn achievements?',
  moreToUnlock: 'more to unlock',
  unlockedOn: 'Unlocked on',
  locked: 'Not yet unlocked',
  howToUnlock: 'How to unlock this?',
  items: {
    eerste_betaling: { name: 'First Step', desc: 'Paid your first bill', howTo: 'Mark your first bill as paid.' },
    vijf_betaald: { name: 'Rolling', desc: '5 bills paid', howTo: 'Pay a total of 5 bills.' },
    tien_betaald: { name: 'Persistent', desc: '10 bills paid', howTo: 'Pay a total of 10 bills.' },
    twintig_betaald: { name: 'Master Payer', desc: '20 bills paid', howTo: 'Pay a total of 20 bills.' },
    vijftig_betaald: { name: 'Legend', desc: '50 bills paid', howTo: 'Pay a total of 50 bills.' },
    streak_3: { name: 'Three-peat', desc: '3 on time in a row', howTo: 'Pay 3 bills on time consecutively.' },
    streak_5: { name: 'High Five', desc: '5 on time in a row', howTo: 'Pay 5 bills on time consecutively.' },
    streak_10: { name: 'Champion', desc: '10 on time in a row', howTo: 'Pay 10 bills on time consecutively.' },
    streak_20: { name: 'Unstoppable', desc: '20 on time in a row', howTo: 'Pay 20 bills on time consecutively.' },
    nul_achterstallig: { name: 'Clean Slate', desc: 'No overdue bills', howTo: 'Make sure you have no overdue bills.' },
    alle_betaald: { name: 'Debt Free', desc: 'All bills paid', howTo: 'Pay all your outstanding bills.' },
    bespaard_100: { name: 'Piggy Bank', desc: '€100 collection costs saved', howTo: 'Save €100 by paying on time.' },
    bespaard_500: { name: 'Money Wise', desc: '€500 collection costs saved', howTo: 'Save €500 by paying on time.' },
    scanner: { name: 'Scanner', desc: 'First photo scan', howTo: 'Scan a bill with your camera.' },
    gmail_koppeling: { name: 'Connected', desc: 'Gmail linked', howTo: 'Link your Gmail in Settings.' },
    brief_geschreven: { name: 'Spokesperson', desc: 'First draft letter', howTo: 'Write a draft letter for a bill.' },
    gemeente_ingesteld: { name: 'Local Hero', desc: 'Municipality set', howTo: 'Set your municipality in Profile.' },
    donkere_modus: { name: 'Night Owl', desc: 'Dark mode enabled', howTo: 'Enable dark mode.' },
    meldingen_aan: { name: 'Informed', desc: 'Notifications enabled', howTo: 'Enable push notifications.' },
    mood_gelogd: { name: 'In Touch', desc: 'Mood logged', howTo: 'Log your mood on the dashboard.' },
  },
};

const NL_MOOD = {
  title: 'Hoe voel je je vandaag?',
  logged: 'Bedankt! Je stemming is gelogd.',
};

const EN_MOOD = {
  title: 'How are you feeling today?',
  logged: 'Thanks! Your mood has been logged.',
};

const NL_STAGES = {
  factuur: 'Factuur',
  herinnering: 'Herinnering',
  aanmaning: 'Aanmaning',
  incasso: 'Incasso',
  deurwaarder: 'Deurwaarder',
};

const EN_STAGES = {
  factuur: 'Invoice',
  herinnering: 'Reminder',
  aanmaning: 'Final notice',
  incasso: 'Collection',
  deurwaarder: 'Bailiff',
};

// NEW: Settings menu translations
const NL_SETTINGS = {
  title: 'Instellingen',
  profile: 'Profiel',
  profileDesc: 'Beheer je persoonlijke gegevens',
  gmailAccounts: 'Gmail Accounts',
  gmailAccountsDesc: 'Koppel je e-mail voor automatische import',
  notifications: 'Meldingen',
  notificationsDesc: 'Beheer je notificaties',
  achievements: 'Prestaties',
  achievementsDesc: 'Bekijk je prestaties en badges',
  budget: 'Budget',
  budgetDesc: 'Stel je maandelijks budget in',
  debtHelp: 'Schuldhulp',
  debtHelpDesc: 'Vind hulp bij jou in de buurt'
};

const EN_SETTINGS = {
  title: 'Settings',
  profile: 'Profile',
  profileDesc: 'Manage your personal details',
  gmailAccounts: 'Gmail Accounts',
  gmailAccountsDesc: 'Link your email for automatic import',
  notifications: 'Notifications',
  notificationsDesc: 'Manage your notification preferences',
  achievements: 'Achievements',
  achievementsDesc: 'View your achievements and badges',
  budget: 'Budget',
  budgetDesc: 'Set your monthly budget',
  debtHelp: 'Debt Help',
  debtHelpDesc: 'Find help in your area'
};

function updateFile(filePath, achievements, mood, stages, settings) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  content.achievements = achievements;
  content.mood = mood;
  content.escalation = stages;
  
  // Merge settings without overwriting existing settings keys
  content.settings = { ...content.settings, ...settings };
  
  // Add stage to addBill
  if (!content.addBill) content.addBill = {};
  content.addBill.stage = achievements === NL_ACHIEVEMENTS ? 'Fase' : 'Stage';
  content.addBill.stagePlaceholder = achievements === NL_ACHIEVEMENTS ? 'Selecteer escalatiefase' : 'Select escalation stage';
  
  // Add edit keys
  if (!content.billDetail) content.billDetail = {};
  content.billDetail.editBill = achievements === NL_ACHIEVEMENTS ? 'Bewerken' : 'Edit';
  content.billDetail.editBillDesc = achievements === NL_ACHIEVEMENTS ? 'Wijzig gegevens van deze rekening' : 'Change details of this bill';
  content.billDetail.saveChanges = achievements === NL_ACHIEVEMENTS ? 'Opslaan' : 'Save changes';
  content.billDetail.editSaved = achievements === NL_ACHIEVEMENTS ? 'Wijzigingen opgeslagen' : 'Changes saved';
  
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  console.log('Updated:', filePath);
}

const nlPath = path.join(__dirname, '..', 'src', 'messages', 'nl.json');
const enPath = path.join(__dirname, '..', 'src', 'messages', 'en.json');

updateFile(nlPath, NL_ACHIEVEMENTS, NL_MOOD, NL_STAGES, NL_SETTINGS);
updateFile(enPath, EN_ACHIEVEMENTS, EN_MOOD, EN_STAGES, EN_SETTINGS);

console.log('Done! Achievement, mood, stage, and settings translations added.');
