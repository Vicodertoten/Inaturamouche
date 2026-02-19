// server/services/warmup.js
// Warmup helpers for reducing cold-start latency

import { buildCacheKey } from '../../lib/quiz-utils.js';
import { getObservationPool } from './observationPool.js';
import { findPackById } from '../packs/index.js';
import { getWarmupPackIds } from './catalogService.js';

const DEFAULT_LOCALE = 'fr';

/**
 * Pre-warm the default observation pool to reduce first-question latency.
 * This is a best-effort background task and must not throw.
 */
export async function warmDefaultObservationPool({ logger } = {}) {
  const params = {
    quality_grade: 'research',
    photos: true,
    rank: 'species',
    per_page: 80,
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
  const packIds = getWarmupPackIds({ region: 'europe', limit: 4 });

  for (const packId of packIds) {
    const pack = findPackById(packId);
    if (!pack) continue;

    const params = {
      quality_grade: 'research',
      photos: true,
      rank: 'species',
      per_page: 80,
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
      });
      logger?.info?.({ packId, cacheKey }, `Warmup pack pool (${packId}) completed`);
    } catch (err) {
      logger?.warn?.({ packId, error: err?.message, cacheKey }, `Warmup pack pool (${packId}) failed`);
    }
  }
}

export default warmDefaultObservationPool;
