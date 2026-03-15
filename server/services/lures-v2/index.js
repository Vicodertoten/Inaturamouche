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

/**
 * Build a set of lure (distractor) species for a quiz question using the v2 engine.
 *
 * Pipeline: CandidateIndex → DifficultyPolicy → Selector (with relaxation ladder) → QualityValidator.
 *
 * @param {object} opts
 * @param {object} opts.pool             Observation pool ({ byTaxon, taxonList, confusionMap }).
 * @param {object} opts.selectionState   Per-client selection state.
 * @param {string} opts.targetTaxonId    Target (correct) taxon ID.
 * @param {object} opts.targetObservation Target observation with taxon ancestors.
 * @param {number} opts.lureCount        Number of lures to produce (typically 3).
 * @param {string} opts.gameMode         Game mode (easy | riddle).
 * @param {Function} opts.rng            Seeded random number generator.
 * @param {object} [opts.options]        Extra options (excludeTaxonIds, lureUsageCount, globalDifficultyBoost, minCloseness).
 * @returns {{ lures: Array<{ taxonId: string, obs: object, score: number, closeness: number, source: string }>, source: string, relaxLevel: number, quality: { ok: boolean, reason?: string } }}
 */
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
