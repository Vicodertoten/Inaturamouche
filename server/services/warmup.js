// server/services/warmup.js
// Warmup helpers for reducing cold-start latency

import { buildCacheKey } from '../../lib/quiz-utils.js';
import { getObservationPool } from './observationPool.js';
import { findPackById } from '../packs/index.js';
import { getWarmupPackIds } from './catalogService.js';

const DEFAULT_LOCALE = 'fr';
const WARMUP_PER_PAGE = 40;
const WARMUP_MAX_PAGES = 1;
const WARMUP_PACK_LIMIT = 2;
const WARMUP_PACK_STAGGER_MS = 450;
const WARMUP_PRIORITY_PACK_IDS = ['world_mammals'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pre-warm the default observation pool to reduce first-question latency.
 * This is a best-effort background task and must not throw.
 */
export async function warmDefaultObservationPool({ logger } = {}) {
  const params = {
    quality_grade: 'research',
    photos: true,
    rank: 'species',
    per_page: WARMUP_PER_PAGE,
    locale: DEFAULT_LOCALE,
  };

  const cacheKey = buildCacheKey(params);

  try {
    await getObservationPool({
      cacheKey,
      params,
      monthDayFilter: null,
      logger,
      requestId: 'warmup',
      skipTotalProbe: true,
      maxPagesOverride: WARMUP_MAX_PAGES,
    });
    logger?.info?.({ cacheKey }, 'Warmup observation pool completed');
  } catch (err) {
    logger?.warn?.({ error: err?.message, cacheKey }, 'Warmup observation pool failed');
  }
}

/**
 * Pre-warm pack-specific observation pools.
 */
export async function warmPackPools({ logger } = {}) {
  const catalogWarmupPackIds = getWarmupPackIds({ region: 'europe', limit: WARMUP_PACK_LIMIT });
  const packIds = [];
  const seen = new Set();

  for (const packId of [...WARMUP_PRIORITY_PACK_IDS, ...catalogWarmupPackIds]) {
    if (!packId || seen.has(packId)) continue;
    if (!findPackById(packId)) continue;
    seen.add(packId);
    packIds.push(packId);
  }

  for (const [index, packId] of packIds.entries()) {
    const pack = findPackById(packId);
    if (!pack) continue;

    const params = {
      quality_grade: 'research',
      photos: true,
      rank: 'species',
      per_page: WARMUP_PER_PAGE,
      locale: DEFAULT_LOCALE,
    };

    if (pack.type === 'list' && Array.isArray(pack.taxa_ids)) {
      params.taxon_id = pack.taxa_ids.join(',');
    } else if (pack.api_params) {
      Object.assign(params, pack.api_params);
    }

    const cacheKey = buildCacheKey(params);

    try {
      await getObservationPool({
        cacheKey,
        params,
        monthDayFilter: null,
        logger,
        requestId: `warmup-${packId}`,
        skipTotalProbe: true,
        maxPagesOverride: WARMUP_MAX_PAGES,
      });
      logger?.info?.({ packId, cacheKey }, `Warmup pack pool (${packId}) completed`);
    } catch (err) {
      logger?.warn?.({ packId, error: err?.message, cacheKey }, `Warmup pack pool (${packId}) failed`);
    }
    if (index < packIds.length - 1) {
      await sleep(WARMUP_PACK_STAGGER_MS);
    }
  }
}

export default warmDefaultObservationPool;
