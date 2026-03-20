/**
 * Run: node scripts/add-step49-translations.js
 * Forces missing budget/settings keys. Uses overwrite mode for keys that are MISSING.
 */
const fs = require('fs');
const path = require('path');

function forceKeys(filePath, keys) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  for (const [ns, vals] of Object.entries(keys)) {
    if (!content[ns]) content[ns] = {};
    for (const [k, v] of Object.entries(vals)) {
      content[ns][k] = v; // Force overwrite
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  console.log('Updated:', filePath);
}

forceKeys(path.join(__dirname, '..', 'src', 'messages', 'nl.json'), {
  settings: {
    maxOpenBills: 'Max. openstaande rekeningen',
    maxOpenBillsDesc: 'Waarschuwing als je meer openstaande rekeningen hebt dan dit aantal.',
    overBudgetWarning: 'Budget overschreden',
    overBudgetDesc: 'Je openstaande rekeningen ({total}) zijn hoger dan je budget ({budget}).',
    categoryBreakdown: 'Overzicht per categorie',
    monthlyBudget: 'Maandelijks budget',
    monthlyBudgetDesc: 'Stel een budget in en ontvang een waarschuwing als je erover gaat.',
    save: 'Opslaan',
    saved: 'Opgeslagen',
    achievements: 'Prestaties',
    achievementsDesc: 'Bekijk je prestaties en badges',
  },
});

forceKeys(path.join(__dirname, '..', 'src', 'messages', 'en.json'), {
  settings: {
    maxOpenBills: 'Max. open bills',
    maxOpenBillsDesc: 'Warning when you have more open bills than this number.',
    overBudgetWarning: 'Budget exceeded',
    overBudgetDesc: 'Your outstanding bills ({total}) exceed your budget ({budget}).',
    categoryBreakdown: 'Breakdown by category',
    monthlyBudget: 'Monthly budget',
    monthlyBudgetDesc: 'Set a budget and get a warning when you exceed it.',
    save: 'Save',
    saved: 'Saved',
    achievements: 'Achievements',
    achievementsDesc: 'View your achievements and badges',
  },
});

console.log('Done! All missing keys forced.');
