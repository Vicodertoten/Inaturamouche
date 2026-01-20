// server/services/warmup.js
// Warmup helpers for reducing cold-start latency

import { buildCacheKey } from '../../lib/quiz-utils.js';
import { getObservationPool } from './observationPool.js';

const DEFAULT_LOCALE = 'fr';
const DEFAULT_GAME_MODE = 'easy';

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

  const cacheKey = buildCacheKey({ ...params, game_mode: DEFAULT_GAME_MODE });

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

export default warmDefaultObservationPool;
