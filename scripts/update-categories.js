/**
 * Run this script ONCE after unzipping to update category keys in translation files.
 * Usage: node scripts/update-categories.js
 */
const fs = require('fs');
const path = require('path');

const NL_CATEGORIES = {
  wonen: 'Wonen',
  nutsvoorzieningen: 'Nutsvoorzieningen',
  zorg: 'Zorg',
  verzekeringen: 'Verzekeringen',
  telecom: 'Telecom & Internet',
  overheid: 'Overheid & Belastingen',
  vervoer: 'Vervoer',
  leningen: 'Leningen & Kredieten',
  winkels: 'Winkels & Aankopen',
  abonnementen: 'Abonnementen',
  gezin: 'Gezin & Kinderen',
  zakelijk: 'Zakelijk',
  incasso_kosten: 'Incasso & Gerechtskosten',
  overig: 'Overig',
};

const EN_CATEGORIES = {
  wonen: 'Housing',
  nutsvoorzieningen: 'Utilities',
  zorg: 'Healthcare',
  verzekeringen: 'Insurance',
  telecom: 'Telecom & Internet',
  overheid: 'Government & Tax',
  vervoer: 'Transport',
  leningen: 'Loans & Credit',
  winkels: 'Shopping & Purchases',
  abonnementen: 'Subscriptions',
  gezin: 'Family & Children',
  zakelijk: 'Business',
  incasso_kosten: 'Collection & Legal Costs',
  overig: 'Other',
};

function updateFile(filePath, newCategories) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Update addBill.categories
  if (content.addBill && content.addBill.categories) {
    content.addBill.categories = newCategories;
  } else {
    if (!content.addBill) content.addBill = {};
    content.addBill.categories = newCategories;
  }

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  console.log('Updated:', filePath);
}

const nlPath = path.join(__dirname, '..', 'src', 'messages', 'nl.json');
const enPath = path.join(__dirname, '..', 'src', 'messages', 'en.json');

updateFile(nlPath, NL_CATEGORIES);
updateFile(enPath, EN_CATEGORIES);

console.log('Done! Categories updated to 14 main categories.');
