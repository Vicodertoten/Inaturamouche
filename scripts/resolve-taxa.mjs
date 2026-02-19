#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

function printUsageAndExit(code = 2) {
  console.error('Usage: node scripts/resolve-taxa.mjs --input pack.csv [--overrides overrides.json] [--locale en] [--out resolved.json] [--ambiguities-out ambiguities.json]');
  process.exit(code);
}

function parseArgs(argv) {
  const out = {
    input: '',
    overrides: '',
    locale: 'en',
    output: '',
    ambiguitiesOutput: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--input' && next) {
      out.input = next;
      i += 1;
      continue;
    }
    if (token === '--overrides' && next) {
      out.overrides = next;
      i += 1;
      continue;
    }
    if (token === '--locale' && next) {
      out.locale = next || 'en';
      i += 1;
      continue;
    }
    if (token === '--out' && next) {
      out.output = next;
      i += 1;
      continue;
    }
    if (token === '--ambiguities-out' && next) {
      out.ambiguitiesOutput = next;
      i += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printUsageAndExit(0);
    }
  }

  return out;
}

function normalize(value) {
  return String(value || '').trim();
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  const flushCell = () => {
    row.push(cell);
    cell = '';
  };

  const flushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      flushCell();
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1;
      flushCell();
      flushRow();
      continue;
    }

    cell += char;
  }

  flushCell();
  if (row.length > 1 || normalize(row[0])) {
    flushRow();
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => normalize(h));
  return rows.slice(1).map((values) => {
    const entry = {};
    for (let i = 0; i < headers.length; i += 1) {
      entry[headers[i]] = normalize(values[i] || '');
    }
    return entry;
  });
}

async function loadOverrides(pathname) {
  if (!pathname) return {};
  const raw = await readFile(pathname, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function computeCandidateScore({ scientificName, commonName }, candidate) {
  const sci = normalize(scientificName).toLowerCase();
  const com = normalize(commonName).toLowerCase();

  const candidateSci = normalize(candidate?.name).toLowerCase();
  const candidateCom = normalize(candidate?.preferred_common_name).toLowerCase();

  let score = 0;
  if (sci && sci === candidateSci) score += 100;
  if (sci && candidateSci.startsWith(sci)) score += 30;
  if (com && com === candidateCom) score += 70;
  if (com && candidateCom.startsWith(com)) score += 20;

  return score;
}

async function searchTaxa(query, locale) {
  const url = new URL('https://api.inaturalist.org/v1/taxa/autocomplete');
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', '30');
  url.searchParams.set('locale', locale);

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`iNat taxa autocomplete failed (${res.status}) for query "${query}"`);
  }

  const json = await res.json();
  return Array.isArray(json?.results) ? json.results : [];
}

async function resolveOne(row, { locale, overrides }) {
  const scientificName = normalize(row.scientific_name);
  const commonName = normalize(row.common_name);
  const overrideKey = scientificName || commonName;

  const overrideValue = Number(overrides[overrideKey]);
  if (Number.isFinite(overrideValue) && overrideValue > 0) {
    return {
      source: 'override',
      taxon: {
        id: overrideValue,
        name: scientificName || commonName,
        preferred_common_name: commonName || scientificName,
        rank: '',
      },
      ambiguity: null,
    };
  }

  const query = scientificName || commonName;
  if (!query) {
    return {
      source: 'missing_query',
      taxon: null,
      ambiguity: {
        reason: 'missing scientific_name/common_name',
      },
    };
  }

  const candidates = await searchTaxa(query, locale);
  if (candidates.length === 0) {
    return {
      source: 'not_found',
      taxon: null,
      ambiguity: {
        reason: 'no candidates returned',
        query,
      },
    };
  }

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: computeCandidateScore({ scientificName, commonName }, candidate),
    }))
    .sort((a, b) => {
      const scoreCmp = b.score - a.score;
      if (scoreCmp !== 0) return scoreCmp;
      return Number(a.candidate?.id || 0) - Number(b.candidate?.id || 0);
    });

  const top = ranked[0];
  const second = ranked[1];
  const isAmbiguous = Boolean(second && top.score === second.score && top.score > 0);

  return {
    source: 'autocomplete',
    taxon: top.candidate,
    ambiguity: isAmbiguous
      ? {
          reason: 'score tie',
          query,
          first_candidate_id: Number(top.candidate?.id),
          second_candidate_id: Number(second.candidate?.id),
          score: top.score,
        }
      : null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    printUsageAndExit(2);
  }

  const rawCsv = await readFile(args.input, 'utf8');
  const rows = parseCsv(rawCsv);
  const overrides = await loadOverrides(args.overrides);
  const validatedAt = new Date().toISOString();

  const results = [];
  const ambiguities = [];

  for (const row of rows) {
    const resolved = await resolveOne(row, { locale: args.locale, overrides });
    if (resolved.ambiguity) {
      ambiguities.push({
        scientific_name: normalize(row.scientific_name),
        common_name: normalize(row.common_name),
        ...resolved.ambiguity,
      });
    }

    if (!resolved.taxon) continue;

    results.push({
      inaturalist_id: Number(resolved.taxon.id),
      name: normalize(resolved.taxon.name),
      common_name: normalize(resolved.taxon.preferred_common_name || row.common_name),
      rank: normalize(resolved.taxon.rank),
      region: normalize(row.region),
      source_ref: normalize(row.source_ref),
      source_url: normalize(row.source_url),
      notes: normalize(row.notes),
      validated_at: validatedAt,
      resolver_source: resolved.source,
    });
  }

  results.sort((a, b) => {
    const idCmp = (a.inaturalist_id || 0) - (b.inaturalist_id || 0);
    if (idCmp !== 0) return idCmp;
    return String(a.name).localeCompare(String(b.name));
  });

  const payload = {
    generated_at: validatedAt,
    source_csv: args.input,
    resolved_count: results.length,
    ambiguity_count: ambiguities.length,
    results,
  };

  const serialized = JSON.stringify(payload, null, 2);
  if (args.output) {
    await writeFile(args.output, serialized);
    console.error(`Wrote ${results.length} resolved taxa to ${args.output}`);
  } else {
    process.stdout.write(`${serialized}\n`);
  }

  if (args.ambiguitiesOutput) {
    const ambiguityPayload = JSON.stringify({ generated_at: validatedAt, ambiguities }, null, 2);
    await writeFile(args.ambiguitiesOutput, ambiguityPayload);
    console.error(`Wrote ${ambiguities.length} ambiguities to ${args.ambiguitiesOutput}`);
  } else if (ambiguities.length > 0) {
    console.error(`Ambiguities detected: ${ambiguities.length}`);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
