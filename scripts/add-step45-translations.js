/**
 * Run ONCE: node scripts/add-step45-translations.js
 * Adds budget threshold translations
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
  settings: {
    maxOpenBills: 'Maximaal openstaande rekeningen',
    maxOpenBillsDesc: 'Je ontvangt een waarschuwing als je meer openstaande rekeningen hebt dan dit aantal.',
    overBudgetWarning: 'Budget overschreden',
    overBudgetDesc: 'Je openstaande rekeningen ({total}) zijn hoger dan je budget ({budget}).',
    categoryBreakdown: 'Overzicht per categorie',
  },
};

const EN = {
  settings: {
    maxOpenBills: 'Maximum open bills',
    maxOpenBillsDesc: 'You will receive a warning when you have more open bills than this number.',
    overBudgetWarning: 'Budget exceeded',
    overBudgetDesc: 'Your outstanding bills ({total}) exceed your budget ({budget}).',
    categoryBreakdown: 'Breakdown by category',
  },
};

addKeys(path.join(__dirname, '..', 'src', 'messages', 'nl.json'), NL);
addKeys(path.join(__dirname, '..', 'src', 'messages', 'en.json'), EN);
console.log('Done!');
