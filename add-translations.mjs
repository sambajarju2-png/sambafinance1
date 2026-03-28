#!/usr/bin/env node

/**
 * Run from sambafinance1 root:
 *   node add-translations.mjs
 *
 * Adds missing dashboard translation keys to both en.json and nl.json
 */

import { readFileSync, writeFileSync } from 'fs';

const NEW_KEYS = {
  en: {
    dashboard: {
      tabOverview: "Overview",
      tabAiInsight: "AI Insight",
      billSingular: "bill",
      billPlural: "bills",
      onTrack: "You're on track",
      payNow: "Pay now",
      withinSevenDays: "within 7 days",
      thisMonth: "this month",
      savedOnCollection: "saved on collection costs",
      payOnTimeToSave: "Pay on time to save on collection costs",
    },
  },
  nl: {
    dashboard: {
      tabOverview: "Overzicht",
      tabAiInsight: "AI Inzicht",
      billSingular: "rekening",
      billPlural: "rekeningen",
      onTrack: "Je ligt op schema",
      payNow: "Direct betalen",
      withinSevenDays: "binnen 7 dagen",
      thisMonth: "deze maand",
      savedOnCollection: "bespaard aan incassokosten",
      payOnTimeToSave: "Betaal op tijd om incassokosten te besparen",
    },
  },
};

for (const [lang, sections] of Object.entries(NEW_KEYS)) {
  const filePath = `src/messages/${lang}.json`;
  try {
    const existing = JSON.parse(readFileSync(filePath, 'utf-8'));

    for (const [section, keys] of Object.entries(sections)) {
      if (!existing[section]) existing[section] = {};
      for (const [key, value] of Object.entries(keys)) {
        if (!existing[section][key]) {
          existing[section][key] = value;
          console.log(`  + ${lang}.json → ${section}.${key}`);
        }
      }
    }

    writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n');
    console.log(`✓ Updated ${filePath}`);
  } catch (err) {
    console.error(`✗ Failed to update ${filePath}:`, err.message);
  }
}

console.log('\nDone! New keys added without touching existing translations.');
