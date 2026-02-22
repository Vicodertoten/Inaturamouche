// server/services/lures-v2/index.js
// Orchestrateur du nouveau moteur de lures

import { pickObservationForTaxon } from '../selectionState.js';
import { buildCandidateIndex } from './CandidateIndex.js';
import { getDifficultyPolicy } from './DifficultyPolicy.js';
import { selectLureCandidates } from './Selector.js';
import { validateLureSet } from './QualityValidator.js';

function resolveLureObservation(pool, selectionState, candidate, rng) {
  if (candidate?.obs) return candidate.obs;

  const taxonId = String(candidate?.tid || '');
  if (!taxonId || !pool?.byTaxon?.has?.(taxonId)) return null;

  return (
    pickObservationForTaxon(pool, selectionState, taxonId, { allowSeen: false }, rng)
    || pickObservationForTaxon(pool, selectionState, taxonId, { allowSeen: true }, rng)
    || pool.byTaxon.get(taxonId)?.[0]
    || null
  );
}

export function buildLuresV2({
  pool,
  selectionState,
  targetTaxonId,
  targetObservation,
  lureCount,
  gameMode,
  rng,
  options = {},
}) {
  const sourceIndex = buildCandidateIndex(pool, targetTaxonId, targetObservation);
  const policy = getDifficultyPolicy(gameMode, {
    globalDifficultyBoost: options.globalDifficultyBoost,
    minClosenessOverride: options.minCloseness,
  });

  const { selected, relaxLevel } = selectLureCandidates({
    candidates: sourceIndex.candidates,
    lureCount,
    policy,
    excludeTaxonIds: options.excludeTaxonIds,
    lureUsageCount: options.lureUsageCount,
    rng,
    strictMinCloseness: options.minCloseness != null,
  });

  const lures = [];
  for (const candidate of selected) {
    const obs = resolveLureObservation(pool, selectionState, candidate, rng);
    if (!obs) continue;
    lures.push({
      taxonId: String(candidate.tid),
      obs,
      score: candidate.score,
      closeness: candidate.closeness,
      source: candidate.source || sourceIndex.source,
    });
  }

  const quality = validateLureSet({
    targetTaxonId,
    lures,
    expectedCount: lureCount,
  });

  return {
    lures: quality.ok ? lures.slice(0, lureCount) : lures,
    source: sourceIndex.source,
    relaxLevel,
    quality,
  };
}

export default buildLuresV2;
