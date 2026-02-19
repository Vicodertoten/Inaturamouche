#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

function printUsageAndExit(code = 2) {
  console.error('Usage: node scripts/resolve-places.mjs --query "Belgium" [--query "Europe"] [--input queries.txt] [--locale en] [--per-page 10] [--out out.json]');
  process.exit(code);
}

function parseArgs(argv) {
  const out = {
    queries: [],
    locale: 'en',
    perPage: 10,
    input: '',
    output: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--query' && next) {
      out.queries.push(next.trim());
      i += 1;
      continue;
    }
    if (token === '--input' && next) {
      out.input = next;
      i += 1;
      continue;
    }
    if (token === '--locale' && next) {
      out.locale = next.trim() || 'en';
      i += 1;
      continue;
    }
    if (token === '--per-page' && next) {
      const parsed = Number.parseInt(next, 10);
      out.perPage = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 30) : 10;
      i += 1;
      continue;
    }
    if (token === '--out' && next) {
      out.output = next;
      i += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printUsageAndExit(0);
    }
  }

  return out;
}

function normalizeQuery(value) {
  return String(value || '').trim();
}

function scoreConfidence(query, candidateName, displayName) {
  const q = normalizeQuery(query).toLowerCase();
  const name = normalizeQuery(candidateName).toLowerCase();
  const display = normalizeQuery(displayName).toLowerCase();

  if (!q) return 0;
  if (q === name || q === display) return 1;
  if (name.startsWith(q) || display.startsWith(q)) return 0.92;
  if (name.includes(q) || display.includes(q)) return 0.75;
  return 0.45;
}

async function readQueriesFromFile(pathname) {
  const raw = await readFile(pathname, 'utf8');
  return raw
    .split(/\r?\n/g)
    .map((line) => normalizeQuery(line))
    .filter(Boolean);
}

async function fetchPlaceCandidates({ query, locale, perPage }) {
  const url = new URL('https://api.inaturalist.org/v1/places/autocomplete');
  url.searchParams.set('q', query);
  url.searchParams.set('locale', locale);
  url.searchParams.set('per_page', String(perPage));

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`iNat places autocomplete failed (${res.status}) for query "${query}"`);
  }

  const json = await res.json();
  const results = Array.isArray(json?.results) ? json.results : [];

  return results.map((item) => {
    const name = item?.display_name || item?.name || '';
    const confidence = scoreConfidence(query, item?.name, name);
    return {
      query,
      name,
      place_id: Number(item?.id),
      confidence: Number(confidence.toFixed(2)),
      place_type: item?.place_type_name || '',
      admin_level: item?.admin_level || null,
      location: item?.location || null,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileQueries = args.input ? await readQueriesFromFile(args.input) : [];
  const queries = [...args.queries, ...fileQueries]
    .map((q) => normalizeQuery(q))
    .filter(Boolean);

  if (queries.length === 0) {
    printUsageAndExit(2);
  }

  const dedupedQueries = [...new Set(queries)];
  const all = [];

  for (const query of dedupedQueries) {
    const candidates = await fetchPlaceCandidates({
      query,
      locale: args.locale,
      perPage: args.perPage,
    });
    all.push(...candidates);
  }

  all.sort((a, b) => {
    const queryCmp = String(a.query).localeCompare(String(b.query));
    if (queryCmp !== 0) return queryCmp;
    const confCmp = (b.confidence || 0) - (a.confidence || 0);
    if (confCmp !== 0) return confCmp;
    return (a.place_id || 0) - (b.place_id || 0);
  });

  const payload = {
    generated_at: new Date().toISOString(),
    locale: args.locale,
    query_count: dedupedQueries.length,
    results: all,
  };

  const serialized = JSON.stringify(payload, null, 2);
  if (args.output) {
    await writeFile(args.output, serialized);
    console.error(`Wrote ${all.length} place candidates to ${args.output}`);
  } else {
    process.stdout.write(`${serialized}\n`);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
