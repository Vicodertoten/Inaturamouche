const fs = require('fs');
const path = require('path');

// Load all translation files
const en = require('./client/src/locales/en.js').default;
const fr = require('./client/src/locales/fr.js').default;
const nl = require('./client/src/locales/nl.js').default;

// Get all keys from a translation object recursively
function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Extract keys from all dictionaries
const enKeys = getAllKeys(en).sort();
const frKeys = getAllKeys(fr).sort();
const nlKeys = getAllKeys(nl).sort();

console.log('=== TRANSLATION KEY COMPARISON ===\n');

// Find differences
const enSet = new Set(enKeys);
const frSet = new Set(frKeys);
const nlSet = new Set(nlKeys);

const missingInFr = enKeys.filter(k => !frSet.has(k));
const missingInNl = enKeys.filter(k => !nlSet.has(k));
const missingInEn = frKeys.filter(k => !enSet.has(k));

console.log(`📊 Total keys:`);
console.log(`  EN: ${enKeys.length}`);
console.log(`  FR: ${frKeys.length}`);
console.log(`  NL: ${nlKeys.length}\n`);

if (missingInFr.length > 0) {
  console.log(`⚠️  Missing in FR (${missingInFr.length}):`);
  missingInFr.forEach(k => console.log(`   - ${k}`));
  console.log();
}

if (missingInNl.length > 0) {
  console.log(`⚠️  Missing in NL (${missingInNl.length}):`);
  missingInNl.forEach(k => console.log(`   - ${k}`));
  console.log();
}

if (missingInEn.length > 0) {
  console.log(`⚠️  Missing in EN but in FR (${missingInEn.length}):`);
  missingInEn.forEach(k => console.log(`   - ${k}`));
  console.log();
}

// Check for incomplete translations (identical to English)
console.log('⚠️  Checking for untranslated strings...\n');

const enKeysToCheck = enKeys.filter(k => {
  const enValue = getValueByKey(en, k);
  return typeof enValue === 'string' && enValue.length > 0;
});

const untranslatedFr = enKeysToCheck.filter(k => {
  const enValue = getValueByKey(en, k);
  const frValue = getValueByKey(fr, k);
  return frValue === enValue;
});

const untranslatedNl = enKeysToCheck.filter(k => {
  const enValue = getValueByKey(en, k);
  const nlValue = getValueByKey(nl, k);
  return nlValue === enValue;
});

if (untranslatedFr.length > 0) {
  console.log(`🚨 Identical in FR (${untranslatedFr.length}):`);
  untranslatedFr.slice(0, 10).forEach(k => {
    console.log(`   - ${k}: "${getValueByKey(en, k)}"`);
  });
  if (untranslatedFr.length > 10) console.log(`   ... and ${untranslatedFr.length - 10} more`);
  console.log();
}

if (untranslatedNl.length > 0) {
  console.log(`🚨 Identical in NL (${untranslatedNl.length}):`);
  untranslatedNl.slice(0, 10).forEach(k => {
    console.log(`   - ${k}: "${getValueByKey(en, k)}"`);
  });
  if (untranslatedNl.length > 10) console.log(`   ... and ${untranslatedNl.length - 10} more`);
  console.log();
}

console.log('✅ Analysis complete!');

// Helper function
function getValueByKey(obj, key) {
  const parts = key.split('.');
  let result = obj;
  for (const part of parts) {
    result = result?.[part];
  }
  return result;
}
