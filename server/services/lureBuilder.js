// server/services/lureBuilder.js
// Algorithme LCA pour construire les leurres avec stratégie hybride

import { config } from '../config/index.js';
import { lcaDepth, shuffleFisherYates } from '../../lib/quiz-utils.js';
import { pickObservationForTaxon } from './selectionState.js';
import { fetchSimilarSpeciesWithTimeout } from './iNaturalistClient.js';
import { similarSpeciesCache } from '../cache/similarSpeciesCache.js';

const { lureNearThreshold, lureMidThreshold, lureCount: LURE_COUNT } = config;
const LURE_NEAR_THRESHOLD = lureNearThreshold;
const LURE_MID_THRESHOLD = lureMidThreshold;

/**
 * Builds lure observations with hybrid strategy:
 * 1. Try to fetch similar species from iNaturalist API with strict timeout (900ms)
 * 2. If API responds: use similar species as primary lures, complement with phylogenetically close species
 * 3. If API times out or fails: silently fall back to LCA-only strategy (near/mid/far buckets)
 *
 * @param {{ taxonList: (string|number)[], byTaxon: Map<string, any[]> }} pool Observation pool indexed by taxon id.
 * @param {any} selectionState Tracks recently used observations per client.
 * @param {string|number} targetTaxonId Taxon id of the correct answer.
 * @param {any} targetObservation Representative observation for the target (provides ancestor_ids).
 * @param {number} [lureCount=LURE_COUNT] Number of lures to produce (default 3 for 4-choice quiz).
 * @param {() => number} [rng] Optional RNG for deterministic lure ordering.
 * @returns {Promise<{ lures: Array<{ taxonId: string, obs: any }>, buckets: { near: number, mid: number, far: number }, source: string }>}
 */
export async function buildLures(
  pool,
  selectionState,
  targetTaxonId,
  targetObservation,
  lureCount = LURE_COUNT,
  rng = Math.random
) {
  const targetId = String(targetTaxonId);
  const seenTaxa = new Set([targetId]);
  const random = typeof rng === 'function' ? rng : Math.random;

  const targetAnc = Array.isArray(targetObservation?.taxon?.ancestor_ids)
    ? targetObservation.taxon.ancestor_ids
    : [];
  const targetDepth = Math.max(targetAnc.length, 1);

  // Récupérer l'iconic_taxon_id de la cible
  const targetIconicTaxonId = targetObservation?.taxon?.iconic_taxon_id || null;

  const candidates = pool.taxonList.filter((tid) => {
    if (String(tid) === targetId) return false;
    if (!pool.byTaxon.get(String(tid))?.length) return false;

    // CONTRAINTE : Le leurre doit avoir le même iconic_taxon_id que la cible
    // Cela évite de mélanger des taxons de groupes complètement différents
    if (targetIconicTaxonId) {
      const rep = pool.byTaxon.get(String(tid))?.[0];
      if (rep?.taxon?.iconic_taxon_id !== targetIconicTaxonId) {
        return false;
      }
    }

    return true;
  });

  // Compute phylogenetic scores for all candidates
  const scored = candidates.map((tid) => {
    const list = pool.byTaxon.get(String(tid)) || [];
    const rep = list[0] || null;
    const anc = Array.isArray(rep?.taxon?.ancestor_ids) ? rep.taxon.ancestor_ids : [];
    const depth = lcaDepth(targetAnc, anc);
    const closeness = depth / targetDepth; // 0..1
    return { tid: String(tid), rep, depth, closeness };
  });

  // Stratify by phylogenetic proximity
  const near = [],
    mid = [],
    far = [];
  for (const s of scored) {
    if (s.closeness >= LURE_NEAR_THRESHOLD) near.push(s);
    else if (s.closeness >= LURE_MID_THRESHOLD) mid.push(s);
    else far.push(s);
  }

  const jitterSort = (arr) => arr.sort((a, b) => b.depth + random() * 0.01 - (a.depth + random() * 0.01));
  jitterSort(near);
  jitterSort(mid);
  jitterSort(far);

  const out = [];
  const pickFromArr = (arr) => {
    for (const s of arr) {
      if (out.length >= lureCount) return;
      if (seenTaxa.has(s.tid)) continue;
      const obs = pickObservationForTaxon(pool, selectionState, s.tid, { allowSeen: true }, rng) || s.rep;
      if (obs) {
        out.push({ taxonId: s.tid, obs });
        seenTaxa.add(s.tid);
      }
    }
  };

  let lureSource = 'lca-only';

  // HYBRID STRATEGY: Try similar_species API with strict timeout (900ms)
  const cacheKey = `similar:${targetId}`;
  let similarResults = similarSpeciesCache.get(cacheKey, { allowStale: true });
  
  if (!similarResults) {
    similarResults = await fetchSimilarSpeciesWithTimeout(targetId, 900);
    if (Array.isArray(similarResults) && similarResults.length > 0) {
      similarSpeciesCache.set(cacheKey, similarResults);
    }
  }

  if (Array.isArray(similarResults) && similarResults.length > 0) {
    // API responded successfully - use similar species as primary lures
    lureSource = 'api-hybrid';
    const similarIds = Array.from(
      new Set(
        similarResults
          .map((r) => r?.taxon?.id || r?.id || r?.taxon_id)
          .filter(Boolean)
          .map(String)
      )
    ).filter((id) => id !== targetId);

    const scoredMap = new Map(scored.map((s) => [s.tid, s]));

    // Pick from similar species first (only if present in pool and has same iconic_taxon_id)
    for (const sid of similarIds) {
      if (out.length >= lureCount) break;
      if (!scoredMap.has(sid)) continue;
      if (seenTaxa.has(sid)) continue;
      const s = scoredMap.get(sid);
      const obs = pickObservationForTaxon(pool, selectionState, s.tid, { allowSeen: true }, rng) || s.rep;
      if (obs) {
        out.push({ taxonId: s.tid, obs });
        seenTaxa.add(s.tid);
      }
    }

    // Complement remaining slots with phylogenetically close species (near bucket first)
    // Prioriser les candidats avec même Genre (depth élevé)
    if (out.length < lureCount) {
      pickFromArr(near);
    }
  }

  // FALLBACK STRATEGY: LCA-only (near/mid/far buckets)
  // Used when API times out, fails, or returns no results
  if (out.length < lureCount && near.length) pickFromArr([near[0]]);
  if (out.length < lureCount && mid.length) pickFromArr([mid[0]]);
  if (out.length < lureCount && far.length) pickFromArr([far[0]]);
  if (out.length < lureCount) pickFromArr(near);
  if (out.length < lureCount) pickFromArr(mid);
  if (out.length < lureCount) pickFromArr(far);
  if (out.length < lureCount) {
    const rest = shuffleFisherYates(scored, rng);
    pickFromArr(rest);
  }

  return {
    lures: out.slice(0, lureCount),
    buckets: {
      near: out.filter((l) => near.find((n) => n.tid === l.taxonId)).length,
      mid: out.filter((l) => mid.find((m) => m.tid === l.taxonId)).length,
      far: out.filter((l) => far.find((f) => f.tid === l.taxonId)).length,
    },
    source: lureSource,
  };
}
