/**
 * Run ONCE: node scripts/add-step41-translations.js
 * Adds profile, lawyer, escalation tab, delete account, category display translations
 */
const fs = require('fs');
const path = require('path');

function update(filePath, isNl) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Profile editor translations
  if (!content.profile) content.profile = {};
  content.profile.title = isNl ? 'Profiel' : 'Profile';
  content.profile.firstName = isNl ? 'Voornaam' : 'First name';
  content.profile.lastName = isNl ? 'Achternaam' : 'Last name';
  content.profile.dateOfBirth = isNl ? 'Geboortedatum' : 'Date of birth';
  content.profile.email = isNl ? 'E-mailadres' : 'Email address';
  content.profile.emailHint = isNl ? 'E-mail kan niet gewijzigd worden in de app.' : 'Email cannot be changed in the app.';
  content.profile.save = isNl ? 'Opslaan' : 'Save';
  content.profile.saved = isNl ? 'Opgeslagen' : 'Saved';

  // Lawyer referral translations
  if (!content.lawyer) content.lawyer = {};
  content.lawyer.bailiffTitle = isNl ? 'Deurwaarder betrokken' : 'Bailiff involved';
  content.lawyer.collectionTitle = isNl ? 'Incassobureau ingeschakeld' : 'Collection agency involved';
  content.lawyer.description = isNl
    ? 'Bij deze fase is het verstandig om juridisch advies in te winnen. Hieronder vind je advocatenkantoren bij jou in de buurt.'
    : 'At this stage it is wise to seek legal advice. Below are law firms near you.';
  content.lawyer.noGemeente = isNl
    ? 'Stel je gemeente in via Instellingen om advocaten bij jou in de buurt te zien.'
    : 'Set your municipality in Settings to see lawyers near you.';
  content.lawyer.noResults = isNl
    ? 'Geen advocatenkantoren gevonden. Bel het Juridisch Loket: 0900-8020.'
    : 'No law firms found. Call the Legal Desk: 0900-8020.';
  content.lawyer.juridischLoket = isNl ? 'Juridisch Loket' : 'Legal Desk';
  content.lawyer.juridischDesc = isNl ? '0900-8020 (gratis) — voor gratis juridisch advies' : '0900-8020 (free) — for free legal advice';
  content.lawyer.nibudDesc = isNl ? 'nibud.nl — voor financieel advies en schuldhulp' : 'nibud.nl — for financial advice and debt help';

  // Escalation tab translations
  if (!content.billDetail) content.billDetail = {};
  content.billDetail.tabEscalation = isNl ? 'Escalatie' : 'Escalation';
  content.billDetail.currentStage = isNl ? 'Huidige fase' : 'Current stage';
  content.billDetail.draftLetter = isNl ? 'Schrijf concept' : 'Draft letter';
  content.billDetail.draftLetterDesc = isNl ? 'Genereer een brief of bezwaar' : 'Generate a letter or dispute';

  // Delete account
  if (!content.settings) content.settings = {};
  content.settings.deleteAccount = isNl ? 'Account verwijderen' : 'Delete account';
  content.settings.deleteAccountDesc = isNl ? 'Verwijder je account en al je gegevens permanent' : 'Permanently delete your account and all data';
  content.settings.deleteAccountConfirm = isNl ? 'Weet je zeker dat je je account wilt verwijderen? Dit kan niet ongedaan worden gemaakt. Al je rekeningen, scans en gegevens worden permanent verwijderd.' : 'Are you sure you want to delete your account? This cannot be undone. All your bills, scans and data will be permanently deleted.';
  content.settings.deleteAccountButton = isNl ? 'Ja, verwijder mijn account' : 'Yes, delete my account';

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  console.log('Updated:', filePath);
}

update(path.join(__dirname, '..', 'src', 'messages', 'nl.json'), true);
update(path.join(__dirname, '..', 'src', 'messages', 'en.json'), false);
console.log('Done! All translation keys added.');
