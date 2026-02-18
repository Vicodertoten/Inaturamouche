#!/usr/bin/env node
/**
 * Script pour vérifier si les IDs de taxons existent dans iNaturalist API
 * Usage: node scripts/check-taxa-ids.mjs 101 202 fr
 */

const checkTaxaIds = async (taxonIds, locale = 'fr') => {
  if (!taxonIds || taxonIds.length === 0) {
    console.log('❌ Aucun ID fourni. Usage: node scripts/check-taxa-ids.mjs <id1> <id2> [locale]');
    process.exit(1);
  }

  console.log(`\n📋 Vérification des IDs: ${taxonIds.join(', ')} (locale: ${locale})`);
  console.log('━'.repeat(60));

  const chunkIds = (ids, size) => {
    const out = [];
    for (let i = 0; i < ids.length; i += size) {
      out.push(ids.slice(i, i + size));
    }
    return out;
  };

  const chunks = chunkIds(taxonIds.map(String), 25);

  for (const chunk of chunks) {
    const path = `https://api.inaturalist.org/v1/taxa/${chunk.join(',')}`;
    console.log(`\n🔍 Request: ${path}?locale=${locale}`);

    try {
      // Fetch avec locale
      const res1 = await fetch(`${path}?locale=${locale}`, {
        headers: { Accept: 'application/json' },
        timeout: 10000,
      });

      if (!res1.ok) {
        console.log(`❌ Erreur API (locale): HTTP ${res1.status}`);
        const body = await res1.text();
        console.log(`   Response: ${body.substring(0, 200)}`);
        continue;
      }

      const data1 = await res1.json();
      const localizedResults = Array.isArray(data1?.results) ? data1.results : [];

      if (localizedResults.length === 0) {
        console.log(`❌ Aucun résultat trouvé pour: ${chunk.join(', ')}`);
      } else {
        console.log(`✅ Trouvé ${localizedResults.length} taxon(s) en locale ${locale}:`);
        for (const taxon of localizedResults) {
          console.log(`   • ID: ${taxon.id} - ${taxon.preferred_common_name || taxon.name}`);
        }
      }

      // Aussi vérifier en locale par défaut
      const res2 = await fetch(path, {
        headers: { Accept: 'application/json' },
        timeout: 10000,
      });

      if (res2.ok) {
        const data2 = await res2.json();
        const defaultResults = Array.isArray(data2?.results) ? data2.results : [];
        if (defaultResults.length !== localizedResults.length) {
          console.log(`\n📝 En locale par défaut (en): ${defaultResults.length} résultat(s)`);
          for (const taxon of defaultResults) {
            console.log(`   • ID: ${taxon.id} - ${taxon.preferred_common_name || taxon.name}`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Erreur: ${error.message}`);
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log('Si aucun résultat n\'est trouvé, les IDs n\'existent peut-être pas dans iNaturalist.');
  console.log('Vérifiez sur: https://www.inaturalist.org/taxa/{id}\n');
};

// Parse arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/check-taxa-ids.mjs <id1> [<id2> ...] [locale]');
  console.log('Example: node scripts/check-taxa-ids.mjs 101 202 fr');
  process.exit(1);
}

let locale = 'fr';
let ids = args;

// Vérifier si le dernier argument est une locale valide
if (['fr', 'en', 'nl'].includes(args[args.length - 1])) {
  locale = args.pop();
}

const numericIds = ids
  .map(id => parseInt(id, 10))
  .filter(id => Number.isFinite(id) && id > 0);

if (numericIds.length === 0) {
  console.log('❌ Aucun ID valide fourni.');
  process.exit(1);
}

await checkTaxaIds(numericIds, locale);
