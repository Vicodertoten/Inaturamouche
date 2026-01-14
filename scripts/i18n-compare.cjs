const path = require('path');

function flatten(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const val = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(acc, flatten(val, key));
    } else {
      acc[key] = val;
    }
    return acc;
  }, {});
}

function load(filePath) {
  const abs = path.resolve(filePath);
  const data = require(abs).default || require(abs);
  return flatten(data);
}

function missingKeys(base, other) {
  return Object.keys(base).filter(k => !(k in other));
}

const [,, frPath, enPath, nlPath] = process.argv;
if (!frPath || !enPath || !nlPath) {
  console.error('Usage: node scripts/i18n-compare.cjs fr.js en.js nl.js');
  process.exit(2);
}

const fr = load(frPath);
const en = load(enPath);
const nl = load(nlPath);

console.log('fr keys:', Object.keys(fr).length);
console.log('en keys:', Object.keys(en).length);
console.log('nl keys:', Object.keys(nl).length);

const missingInEn = missingKeys(fr, en);
const missingInNl = missingKeys(fr, nl);
const extraInEn = missingKeys(en, fr);
const extraInNl = missingKeys(nl, fr);

console.log('\n--- Missing in en (present in fr) ---');
console.log(missingInEn.join('\n') || '(none)');
console.log('\n--- Missing in nl (present in fr) ---');
console.log(missingInNl.join('\n') || '(none)');
console.log('\n--- Extra in en (not in fr) ---');
console.log(extraInEn.join('\n') || '(none)');
console.log('\n--- Extra in nl (not in fr) ---');
console.log(extraInNl.join('\n') || '(none)');
