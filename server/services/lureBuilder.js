// server/services/lureBuilder.js
// Façade de compatibilité vers le moteur lures-v2

import { config } from '../config/index.js';
import { buildLuresV2 } from './lures-v2/index.js';

const { lureCount: DEFAULT_LURE_COUNT } = config;

/**
 * @deprecated Utiliser buildLuresV2 directement.
 * Conservé pour compatibilité avec les appels existants et les tests.
 */
export function buildLures(
  pool,
  selectionState,
  targetTaxonId,
  targetObservation,
  lureCount = DEFAULT_LURE_COUNT,
  rng = Math.random,
  options = {},
) {
  const result = buildLuresV2({
    pool,
    selectionState,
    targetTaxonId,
    targetObservation,
    lureCount,
    gameMode: options.gameMode || 'easy',
    rng,
    options,
  });

  return {
    lures: result.lures,
    source: result.source,
    relaxLevel: result.relaxLevel,
    quality: result.quality,
  };
}

export default buildLures;
