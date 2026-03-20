/**
 * Run ONCE: node scripts/add-step46-translations.js
 * Adds missing settings keys and fixes PWA iOS instructions
 */
const fs = require('fs');
const path = require('path');

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key]; // Overwrite to fix existing wrong values
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
    achievements: 'Prestaties',
    achievementsDesc: 'Bekijk je prestaties en badges',
    monthlyBudget: 'Maandelijks budget',
    monthlyBudgetDesc: 'Stel een budget in en ontvang een waarschuwing als je erover gaat.',
    save: 'Opslaan',
    saved: 'Opgeslagen',
  },
  pwa: {
    iosStep1Title: 'Tik op het deel-icoon',
    iosStep1Desc: 'Tik onderaan het scherm op het deel-icoon (vierkant met pijl omhoog).',
    iosStep2Title: "'Zet op beginscherm'",
    iosStep2Desc: "Scroll omlaag in het menu en tik op 'Zet op beginscherm'.",
    iosStep3Title: "Tik op 'Voeg toe'",
    iosStep3Desc: "Tik rechtsboven op 'Voeg toe'. PayWatch staat nu op je beginscherm.",
  },
};

const EN = {
  settings: {
    achievements: 'Achievements',
    achievementsDesc: 'View your achievements and badges',
    monthlyBudget: 'Monthly budget',
    monthlyBudgetDesc: 'Set a budget and get a warning when you exceed it.',
    save: 'Save',
    saved: 'Saved',
  },
  pwa: {
    iosStep1Title: 'Tap the Share icon',
    iosStep1Desc: 'Tap the share icon at the bottom of the screen (square with arrow up).',
    iosStep2Title: "'Add to Home Screen'",
    iosStep2Desc: "Scroll down in the menu and tap 'Add to Home Screen'.",
    iosStep3Title: "Tap 'Add'",
    iosStep3Desc: "Tap 'Add' in the top right corner. PayWatch is now on your home screen.",
  },
};

addKeys(path.join(__dirname, '..', 'src', 'messages', 'nl.json'), NL);
addKeys(path.join(__dirname, '..', 'src', 'messages', 'en.json'), EN);
console.log('Done!');
