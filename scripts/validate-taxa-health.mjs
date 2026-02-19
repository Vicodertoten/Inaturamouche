#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

function printUsageAndExit(code = 2) {
  console.error('Usage: node scripts/validate-taxa-health.mjs --input resolved.json [--out health.json] [--place-id 7008] [--min-ok 30] [--min-weak 5] [--concurrency 4]');
  process.exit(code);
}

function parseArgs(argv) {
  const out = {
    input: '',
    output: '',
    placeId: '',
    minOk: 30,
    minWeak: 5,
    concurrency: 4,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--input' && next) {
      out.input = next;
      i += 1;
      continue;
    }
    if (token === '--out' && next) {
      out.output = next;
      i += 1;
      continue;
    }
    if (token === '--place-id' && next) {
      out.placeId = next;
      i += 1;
      continue;
    }
    if (token === '--min-ok' && next) {
      const parsed = Number.parseInt(next, 10);
      out.minOk = Number.isFinite(parsed) && parsed > 0 ? parsed : out.minOk;
      i += 1;
      continue;
    }
    if (token === '--min-weak' && next) {
      const parsed = Number.parseInt(next, 10);
      out.minWeak = Number.isFinite(parsed) && parsed >= 0 ? parsed : out.minWeak;
      i += 1;
      continue;
    }
    if (token === '--concurrency' && next) {
      const parsed = Number.parseInt(next, 10);
      out.concurrency = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 8) : out.concurrency;
      i += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printUsageAndExit(0);
    }
  }

  return out;
}

function normalizeStatus(totalResults, minOk, minWeak) {
  if (totalResults >= minOk) return 'ok';
  if (totalResults >= minWeak) return 'weak';
  return 'reject';
}

async function fetchTaxonHealth({ taxonId, placeId }) {
  const url = new URL('https://api.inaturalist.org/v1/observations');
  url.searchParams.set('taxon_id', String(taxonId));
  url.searchParams.set('quality_grade', 'research');
  url.searchParams.set('rank', 'species');
  url.searchParams.set('per_page', '1');
  if (placeId) url.searchParams.set('place_id', String(placeId));

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`iNat observations failed (${res.status}) for taxon ${taxonId}`);
  }

  const json = await res.json();
  const totalResults = Number(json?.total_results || 0);
  return Number.isFinite(totalResults) ? totalResults : 0;
}

async function mapWithConcurrency(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      output[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(workers);
  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    printUsageAndExit(2);
  }

  const raw = await readFile(args.input, 'utf8');
  const parsed = JSON.parse(raw);
  const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.results) ? parsed.results : [];

  const taxa = source
    .map((item) => ({
      inaturalist_id: Number(item?.inaturalist_id),
      name: String(item?.name || ''),
      common_name: String(item?.common_name || ''),
      rank: String(item?.rank || ''),
    }))
    .filter((item) => Number.isFinite(item.inaturalist_id) && item.inaturalist_id > 0);

  const rows = await mapWithConcurrency(taxa, args.concurrency, async (taxon) => {
    const totalResults = await fetchTaxonHealth({
      taxonId: taxon.inaturalist_id,
      placeId: args.placeId,
    });

    const status = normalizeStatus(totalResults, args.minOk, args.minWeak);
    return {
      ...taxon,
      total_results: totalResults,
      status,
    };
  });

  rows.sort((a, b) => (a.inaturalist_id || 0) - (b.inaturalist_id || 0));

  const summary = rows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.status] += 1;
    return acc;
  }, { total: 0, ok: 0, weak: 0, reject: 0 });

  const payload = {
    generated_at: new Date().toISOString(),
    thresholds: {
      min_ok: args.minOk,
      min_weak: args.minWeak,
    },
    summary,
    taxa: rows,
  };

  const serialized = JSON.stringify(payload, null, 2);
  if (args.output) {
    await writeFile(args.output, serialized);
    console.error(`Wrote health report for ${rows.length} taxa to ${args.output}`);
  } else {
    process.stdout.write(`${serialized}\n`);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
