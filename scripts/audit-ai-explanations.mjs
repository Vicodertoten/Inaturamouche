#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { config } from '../server/config/index.js';
import { TAXA } from '../server/packs/taxa.js';
import { fetchInatJSON, getFullTaxaDetails } from '../server/services/iNaturalistClient.js';
import { generateCustomExplanation, validateAndClean } from '../server/services/ai/index.js';
import { taxonDetailsCache } from '../server/cache/taxonDetailsCache.js';

const DEFAULT_GROUP_KEYS = ['BIRDS', 'MAMMALS', 'PLANTS', 'FUNGI', 'INSECTS'];

function parseArgs(argv) {
  const out = {
    locale: 'fr',
    perGroupSpecies: 14,
    pairsPerGroup: 3,
    maxPages: 2,
    groups: DEFAULT_GROUP_KEYS,
    output: null,
    seed: 20260223,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--locale' && next) {
      out.locale = next;
      i += 1;
    } else if (arg === '--per-group-species' && next) {
      out.perGroupSpecies = Number.parseInt(next, 10) || out.perGroupSpecies;
      i += 1;
    } else if (arg === '--pairs-per-group' && next) {
      out.pairsPerGroup = Number.parseInt(next, 10) || out.pairsPerGroup;
      i += 1;
    } else if (arg === '--max-pages' && next) {
      out.maxPages = Number.parseInt(next, 10) || out.maxPages;
      i += 1;
    } else if (arg === '--groups' && next) {
      out.groups = next
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      i += 1;
    } else if (arg === '--output' && next) {
      out.output = next;
      i += 1;
    } else if (arg === '--seed' && next) {
      out.seed = Number.parseInt(next, 10) || out.seed;
      i += 1;
    }
  }

  return out;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, rng) {
  const arr = [...values];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function countWords(text = '') {
  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function truncate(text, max = 180) {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

async function fetchSpeciesIdsFromGroup(groupTaxonId, locale, targetCount, maxPages) {
  const ids = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    if (ids.length >= targetCount) break;
    const payload = await fetchInatJSON(
      'https://api.inaturalist.org/v1/observations',
      {
        taxon_id: groupTaxonId,
        rank: 'species',
        quality_grade: 'research',
        photos: true,
        locale,
        per_page: 80,
        page,
        order_by: 'observed_on',
        order: 'desc',
      },
      {
        label: `audit-group-${groupTaxonId}`,
      }
    );

    const results = Array.isArray(payload?.results) ? payload.results : [];
    for (const item of results) {
      const id = Number(item?.taxon?.id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= targetCount) break;
    }
  }

  return ids;
}

function makePairs(speciesIds, pairsPerGroup, rng) {
  const shuffled = shuffle(speciesIds, rng);
  const pairs = [];
  for (let i = 0; i + 1 < shuffled.length && pairs.length < pairsPerGroup; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

function summarize(records) {
  const total = records.length;
  const fallbackTrue = records.filter((r) => r.fallback === true).length;
  const withDiscriminant = records.filter((r) => Boolean(r.discriminant)).length;
  const withQualityIssues = records.filter((r) => r.validationIssues.length > 0).length;
  const avgWords = total > 0
    ? Number((records.reduce((sum, r) => sum + r.wordCount, 0) / total).toFixed(1))
    : 0;
  const avgDurationMs = total > 0
    ? Number((records.reduce((sum, r) => sum + r.durationMs, 0) / total).toFixed(1))
    : 0;

  const byGroup = {};
  for (const row of records) {
    if (!byGroup[row.groupKey]) {
      byGroup[row.groupKey] = {
        total: 0,
        fallbackTrue: 0,
        avgWords: 0,
      };
    }
    const target = byGroup[row.groupKey];
    target.total += 1;
    if (row.fallback) target.fallbackTrue += 1;
    target.avgWords += row.wordCount;
  }
  for (const groupKey of Object.keys(byGroup)) {
    const row = byGroup[groupKey];
    row.avgWords = row.total > 0 ? Number((row.avgWords / row.total).toFixed(1)) : 0;
  }

  const fallbackReasonCounts = {};
  for (const row of records) {
    const reason = row.fallbackReason || 'unknown';
    fallbackReasonCounts[reason] = (fallbackReasonCounts[reason] || 0) + 1;
  }

  return {
    total,
    fallbackTrue,
    fallbackRatePct: total > 0 ? Number(((fallbackTrue / total) * 100).toFixed(1)) : 0,
    withDiscriminant,
    discriminantRatePct: total > 0 ? Number(((withDiscriminant / total) * 100).toFixed(1)) : 0,
    withQualityIssues,
    qualityIssuesRatePct: total > 0 ? Number(((withQualityIssues / total) * 100).toFixed(1)) : 0,
    avgWords,
    avgDurationMs,
    byGroup,
    fallbackReasonCounts,
    examples: {
      ai: records
        .filter((r) => r.fallback === false)
        .slice(0, 5)
        .map((r) => ({
          group: r.groupKey,
          pair: `${r.correctId}/${r.wrongId}`,
          explanation: truncate(r.explanation, 220),
          discriminant: r.discriminant || null,
        })),
      fallback: records
        .filter((r) => r.fallback === true)
        .slice(0, 5)
        .map((r) => ({
          group: r.groupKey,
          pair: `${r.correctId}/${r.wrongId}`,
          explanation: truncate(r.explanation, 220),
          discriminant: r.discriminant || null,
        })),
    },
  };
}

function createPairLogger(storage) {
  const push = (level, payload, message) => {
    storage.push({
      level,
      message: String(message || ''),
      payload: payload && typeof payload === 'object' ? payload : null,
    });
  };

  return {
    debug(payload, message) {
      push('debug', payload, message);
    },
    info(payload, message) {
      push('info', payload, message);
    },
    warn(payload, message) {
      push('warn', payload, message);
    },
    error(payload, message) {
      push('error', payload, message);
    },
  };
}

function inferFallbackReason(logEntries, isFallback) {
  if (!isFallback) return 'ai_accepted';

  const messages = logEntries.map((entry) => entry.message || '');
  if (messages.some((msg) => msg.includes('AI response rejected due to quality issues'))) {
    return 'quality_rejected';
  }
  if (messages.some((msg) => msg.includes('Could not parse AI response'))) {
    return 'parse_failed';
  }
  if (messages.some((msg) => msg.includes('Gemini call failed after retries'))) {
    return 'gemini_error';
  }
  if (messages.some((msg) => msg.includes('Using taxonomic group fallback'))) {
    return 'fallback_used_unknown';
  }
  if (messages.some((msg) => msg.includes('Failed to generate explanation'))) {
    return 'pipeline_error';
  }
  return 'fallback_used_unknown';
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (!config.aiEnabled || !config.aiApiKey) {
    console.error('AI audit aborted: AI is disabled or AI_API_KEY is missing.');
    process.exitCode = 1;
    return;
  }

  const validGroups = args.groups
    .map((key) => [key, TAXA[key]])
    .filter(([, value]) => Number.isFinite(value));

  if (validGroups.length === 0) {
    console.error('AI audit aborted: no valid groups selected.');
    process.exitCode = 1;
    return;
  }

  const rng = mulberry32(args.seed);
  const records = [];
  const startedAt = Date.now();
  let pairIndex = 0;

  for (const [groupKey, groupTaxonId] of validGroups) {
    console.log(`\n[audit] group=${groupKey} taxon=${groupTaxonId}`);
    const ids = await fetchSpeciesIdsFromGroup(
      groupTaxonId,
      args.locale,
      args.perGroupSpecies,
      args.maxPages
    );
    console.log(`[audit] fetched species ids=${ids.length}`);

    const pairs = makePairs(ids, args.pairsPerGroup, rng);
    console.log(`[audit] testing pairs=${pairs.length}`);

    for (const [correctId, wrongId] of pairs) {
      pairIndex += 1;
      const requestId = `audit-${Date.now()}-${pairIndex}`;
      try {
        const pairLogs = [];
        const pairLogger = createPairLogger(pairLogs);
        const details = await getFullTaxaDetails(
          [correctId, wrongId],
          args.locale,
          { requestId, allowPartial: false, logger: pairLogger },
          taxonDetailsCache
        );

        const correctTaxon = details.find((t) => Number(t?.id) === correctId);
        const wrongTaxon = details.find((t) => Number(t?.id) === wrongId);
        if (!correctTaxon || !wrongTaxon) {
          console.warn(`[audit] skip missing details pair=${correctId}/${wrongId}`);
          continue;
        }

        const t0 = Date.now();
        const response = await generateCustomExplanation(
          correctTaxon,
          wrongTaxon,
          args.locale,
          pairLogger
        );
        const durationMs = Date.now() - t0;
        const validation = validateAndClean({
          explanation: response.explanation || '',
          discriminant: response.discriminant || '',
        });

        const row = {
          groupKey,
          correctId,
          wrongId,
          fallback: Boolean(response.fallback),
          wordCount: countWords(response.explanation),
          durationMs,
          fallbackReason: inferFallbackReason(pairLogs, Boolean(response.fallback)),
          discriminant: response.discriminant || '',
          sources: Array.isArray(response.sources) ? response.sources : [],
          validationIssues: Array.isArray(validation.issues) ? validation.issues : [],
          explanation: String(response.explanation || ''),
          logs: pairLogs
            .filter((entry) => entry.level === 'warn' || entry.level === 'error')
            .map((entry) => ({
              level: entry.level,
              message: entry.message,
              issues: Array.isArray(entry.payload?.issues) ? entry.payload.issues : [],
            }))
            .slice(0, 8),
        };
        records.push(row);
        console.log(
          `[audit] ${groupKey} pair=${correctId}/${wrongId} fallback=${row.fallback} reason=${row.fallbackReason} words=${row.wordCount} duration=${durationMs}ms`
        );
      } catch (err) {
        console.warn(`[audit] failed pair=${correctId}/${wrongId} error=${err?.message || 'unknown'}`);
      }
    }
  }

  const summary = summarize(records);
  const report = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    config: {
      locale: args.locale,
      perGroupSpecies: args.perGroupSpecies,
      pairsPerGroup: args.pairsPerGroup,
      maxPages: args.maxPages,
      groups: validGroups.map(([group]) => group),
      seed: args.seed,
    },
    summary,
    records,
  };

  const targetPath = args.output
    ? path.resolve(args.output)
    : path.resolve('tmp', `ai-explain-audit-${Date.now()}.json`);
  await writeFile(targetPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n[audit] done');
  console.log(`[audit] report=${targetPath}`);
  console.log(
    `[audit] total=${summary.total} fallbackRate=${summary.fallbackRatePct}% avgWords=${summary.avgWords} avgDurationMs=${summary.avgDurationMs}`
  );
}

run().catch((err) => {
  console.error(`[audit] fatal error: ${err?.message || err}`);
  process.exitCode = 1;
});
