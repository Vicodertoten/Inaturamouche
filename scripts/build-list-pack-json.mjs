#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

function printUsageAndExit(code = 2) {
  console.error('Usage: node scripts/build-list-pack-json.mjs --input resolved.json [--health health.json] [--out pack.json]');
  process.exit(code);
}

function parseArgs(argv) {
  const out = {
    input: '',
    health: '',
    output: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--input' && next) {
      out.input = next;
      i += 1;
      continue;
    }
    if (token === '--health' && next) {
      out.health = next;
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

function normalize(value) {
  return String(value || '').trim();
}

async function loadJson(pathname) {
  const raw = await readFile(pathname, 'utf8');
  return JSON.parse(raw);
}

function loadHealthMap(healthJson) {
  const rows = Array.isArray(healthJson)
    ? healthJson
    : Array.isArray(healthJson?.taxa)
      ? healthJson.taxa
      : [];

  const map = new Map();
  for (const row of rows) {
    const id = Number(row?.inaturalist_id || row?.taxon_id || row?.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    map.set(id, normalize(row?.status).toLowerCase());
  }
  return map;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    printUsageAndExit(2);
  }

  const sourceJson = await loadJson(args.input);
  const sourceRows = Array.isArray(sourceJson)
    ? sourceJson
    : Array.isArray(sourceJson?.results)
      ? sourceJson.results
      : [];

  const healthMap = args.health ? loadHealthMap(await loadJson(args.health)) : new Map();
  const validatedAt = new Date().toISOString();

  const deduped = new Map();

  for (const row of sourceRows) {
    const id = Number(row?.inaturalist_id || row?.id);
    if (!Number.isFinite(id) || id <= 0) continue;

    const healthStatus = healthMap.get(id);
    if (healthStatus === 'reject') continue;

    if (!deduped.has(id)) {
      deduped.set(id, {
        inaturalist_id: id,
        name: normalize(row?.name),
        common_name: normalize(row?.common_name),
        rank: normalize(row?.rank),
        region: normalize(row?.region),
        source_ref: normalize(row?.source_ref),
        source_url: normalize(row?.source_url),
        notes: normalize(row?.notes),
        validated_at: normalize(row?.validated_at) || validatedAt,
      });
    }
  }

  const outputRows = [...deduped.values()].sort((a, b) => {
    const nameCmp = String(a.name).localeCompare(String(b.name));
    if (nameCmp !== 0) return nameCmp;
    return (a.inaturalist_id || 0) - (b.inaturalist_id || 0);
  });

  const serialized = JSON.stringify(outputRows, null, 2);
  if (args.output) {
    await writeFile(args.output, serialized);
    console.error(`Wrote ${outputRows.length} curated taxa entries to ${args.output}`);
  } else {
    process.stdout.write(`${serialized}\n`);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
