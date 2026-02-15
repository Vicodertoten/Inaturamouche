// server/services/lureBuilder.js
// Sélection de leurres (mauvaises réponses) pour le quiz.
//
// Architecture « Confusion Map » :
//   La carte de confusion est pré-calculée une seule fois au chargement du pool
//   (voir confusionMap.js). Ici on se contente de piocher dans cette carte
//   en pondérant par le score de similarité et l'historique d'utilisation.
//
//   Plus d'appels réseau, plus de cascade 7 niveaux, plus de timing variable.

import { config } from '../config/index.js';
import { lcaDepth } from '../../lib/quiz-utils.js';
import { pickObservationForTaxon } from './selectionState.js';

const {
  lureCount: DEFAULT_LURE_COUNT,
} = config;

// ── Main export ──────────────────────────────────────────────────────

/**
 * Select lure (wrong-answer) taxa for a quiz question.
 *
 * Uses the pre-computed confusion map when available, with weighted random
 * selection that favours high-similarity candidates while penalising
 * recently used ones.
 *
 * Falls back to inline LCA scoring when confusionMap is null (degrade mode).
 *
 * @param {{ taxonList: string[], byTaxon: Map, confusionMap?: Map }} pool
 * @param {any} selectionState
 * @param {string|number} targetTaxonId
 * @param {any} targetObservation
 * @param {number} [lureCount]
 * @param {() => number} [rng]
 * @param {object} [options]
 * @returns {{ lures: Array<{ taxonId: string, obs: any, score?: number, source?: string }>, source: string }}
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
  const targetId = String(targetTaxonId);
  const random = typeof rng === 'function' ? rng : Math.random;
  const {
    excludeTaxonIds,
    minCloseness = 0,
    lureUsageCount,
  } = options;

  const isExcluded = (tid) => excludeTaxonIds?.has(String(tid));

  // ── Get candidates from confusion map (or fallback) ──

  let candidates = pool.confusionMap?.get(targetId);

  if (!candidates || candidates.length === 0) {
    // Fallback: inline LCA scoring (degrade mode, no confusionMap)
    candidates = buildFallbackCandidates(pool, targetId, targetObservation);
  }

  // ── Filter by constraints ──

  const eligible = candidates.filter((c) => {
    if (c.tid === targetId) return false;
    if (isExcluded(c.tid)) return false;
    if (c.closeness < minCloseness) return false;
    return true;
  });

  // ── Weighted random selection ──

  const chosen = weightedPick(eligible, lureCount, lureUsageCount, random);

  // ── Resolve observations for each chosen lure ──

  const lures = [];
  for (const candidate of chosen) {
    // External candidates carry a pre-fetched observation
    let obs = candidate.obs || null;

    // For in-pool candidates, pick an observation from the pool
    if (!obs && pool.byTaxon.has(candidate.tid)) {
      obs = pickLureObs(pool, selectionState, candidate.tid, random);
    }

    if (!obs) continue;

    lures.push({
      taxonId: candidate.tid,
      obs,
      score: candidate.score,
      source: candidate.source || 'confusion-map',
    });
  }

  return {
    lures: lures.slice(0, lureCount),
    source: pool.confusionMap ? 'confusion-map' : 'lca-fallback',
  };
}

// ── Weighted picking ──────────────────────────────────────────────────

/**
 * Pick `count` candidates using weighted random selection.
 *
 * Weight formula:  w(i) = score(i) / (usageCount(i) + 1)
 *
 * This naturally diversifies lure selection while preserving pedagogical
 * relevance: a high-score lure used 3 times has weight score/4, while
 * a moderate-score lure never used has weight score/1.
 */
function weightedPick(candidates, count, lureUsageCount, rng) {
  if (candidates.length <= count) return candidates.slice();

  const remaining = candidates.map((c) => ({
    ...c,
    weight: c.score / ((lureUsageCount?.get(c.tid) || 0) + 1),
  }));

  const picked = [];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight <= 0) {
      // All weights are zero — pick randomly
      const idx = Math.floor(rng() * remaining.length);
      picked.push(remaining.splice(idx, 1)[0]);
      continue;
    }

    let r = rng() * totalWeight;
    let chosenIdx = remaining.length - 1; // fallback
    for (let j = 0; j < remaining.length; j++) {
      r -= remaining[j].weight;
      if (r <= 0) {
        chosenIdx = j;
        break;
      }
    }

    picked.push(remaining.splice(chosenIdx, 1)[0]);
  }

  return picked;
}

// ── Fallback LCA scoring (no confusion map) ──────────────────────────

/**
 * Build candidates by scoring all pool taxa against the target using LCA depth.
 * Used when confusionMap is not available (degrade mode or build failure).
 */
function buildFallbackCandidates(pool, targetId, targetObservation) {
  const targetAnc = Array.isArray(targetObservation?.taxon?.ancestor_ids)
    ? targetObservation.taxon.ancestor_ids
    : [];
  const targetDepth = Math.max(targetAnc.length, 1);
  const targetIconic = targetObservation?.taxon?.iconic_taxon_id || null;

  const candidates = [];

  for (const tid of pool.taxonList) {
    const tidStr = String(tid);
    if (tidStr === targetId) continue;

    const list = pool.byTaxon.get(tidStr);
    if (!list?.length) continue;

    const rep = list[0];
    const anc = Array.isArray(rep?.taxon?.ancestor_ids) ? rep.taxon.ancestor_ids : [];
    const depth = lcaDepth(targetAnc, anc);
    const closeness = targetDepth > 0 ? depth / targetDepth : 0;

    // Soft iconic constraint: slightly penalize cross-iconic candidates
    const candidateIconic = rep?.taxon?.iconic_taxon_id || null;
    const iconicPenalty = (targetIconic && candidateIconic && targetIconic !== candidateIconic) ? 0.1 : 0;

    candidates.push({
      tid: tidStr,
      score: Math.max(0, closeness - iconicPenalty),
      closeness,
      source: 'lca-fallback',
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// ── Observation picking ──────────────────────────────────────────────

/**
 * Pick an observation for a lure taxon from the pool.
 * Tries unseen first, then seen, then the pool representative.
 */
function pickLureObs(pool, selectionState, tid, rng) {
  return (
    pickObservationForTaxon(pool, selectionState, tid, { allowSeen: false }, rng)
    || pickObservationForTaxon(pool, selectionState, tid, { allowSeen: true }, rng)
    || pool.byTaxon.get(String(tid))?.[0]
    || null
  );
}
