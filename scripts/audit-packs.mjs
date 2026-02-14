import { readFileSync } from 'fs';

const mushrooms = JSON.parse(readFileSync('shared/data/common_european_mushrooms.json', 'utf8'));
const trees = JSON.parse(readFileSync('shared/data/common_european_trees.json', 'utf8'));

function auditPack(name, data) {
  console.log(`\n=== ${name} ===`);
  console.log('Total entries:', data.length);
  const ids = data.map(d => d.inaturalist_id).filter(Boolean);
  const unique = new Set(ids);
  console.log('With IDs:', ids.length);
  console.log('Unique IDs:', unique.size);
  console.log('Duplicates:', ids.length - unique.size);
  const missing = data.filter(d => !d.inaturalist_id);
  console.log('Missing IDs:', missing.length);
  if (missing.length > 0) console.log('  Missing:', missing.map(d => d.scientific_name));
  
  // Check for NaN IDs
  const nanIds = data.filter(d => d.inaturalist_id && isNaN(Number(d.inaturalist_id)));
  console.log('Non-numeric IDs:', nanIds.length);
  if (nanIds.length > 0) console.log('  Bad IDs:', nanIds.map(d => `${d.scientific_name}: "${d.inaturalist_id}"`));
  
  // Check for duplicates
  if (ids.length > unique.size) {
    const seen = new Map();
    for (const d of data) {
      if (!d.inaturalist_id) continue;
      const id = d.inaturalist_id;
      if (seen.has(id)) {
        console.log(`  Duplicate ID ${id}: "${d.scientific_name}" and "${seen.get(id)}"`);
      }
      seen.set(id, d.scientific_name);
    }
  }
}

auditPack('European Mushrooms', mushrooms);
auditPack('European Trees', trees);
