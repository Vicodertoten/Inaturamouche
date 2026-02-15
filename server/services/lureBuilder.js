// server/services/lureBuilder.js
// Algorithme LCA pour construire les leurres avec stratégie hybride

import { config } from '../config/index.js';
import { lcaDepth } from '../../lib/quiz-utils.js';
import { pickObservationForTaxon } from './selectionState.js';
import { fetchInatJSON, fetchSimilarSpeciesWithTimeout } from './iNaturalistClient.js';
import { similarSpeciesCache } from '../cache/similarSpeciesCache.js';
import { sanitizeObservation } from './observationPool.js';

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
 * @param {{ allowMixedIconic?: boolean, allowExternalLures?: boolean, excludeTaxonIds?: Set<string>, logger?: any, requestId?: string, minCloseness?: number }} [options]
 * @returns {Promise<{ lures: Array<{ taxonId: string, obs: any }>, buckets: { near: number, mid: number, far: number }, source: string }>}
 */
export async function buildLures(
  pool,
  selectionState,
  targetTaxonId,
  targetObservation,
  lureCount = LURE_COUNT,
  rng = Math.random,
  options = {}
) {
  const targetId = String(targetTaxonId);
  const seenTaxa = new Set([targetId]);
  const random = typeof rng === 'function' ? rng : Math.random;
  const {
    allowMixedIconic = false,
    allowExternalLures = false,
    excludeTaxonIds,
    logger,
    requestId,
    minCloseness = 0,
    locale = 'fr',
    recentLureTaxa,
  } = options;
  const isExcluded = (tid) => excludeTaxonIds && excludeTaxonIds.has(String(tid));
  // Soft-avoid recently used lure taxa (they can still be picked if pool is small)
  const isRecentLure = (tid) => recentLureTaxa && recentLureTaxa.has(String(tid));

  const targetAnc = Array.isArray(targetObservation?.taxon?.ancestor_ids)
    ? targetObservation.taxon.ancestor_ids
    : [];
  const targetDepth = Math.max(targetAnc.length, 1);
  const normalizedMinCloseness = Number.isFinite(minCloseness) ? minCloseness : 0;
  const closenessFloor = Math.min(Math.max(normalizedMinCloseness, 0), 1);

  // Récupérer l'iconic_taxon_id de la cible
  const targetIconicTaxonId = targetObservation?.taxon?.iconic_taxon_id || null;

  const buildCandidates = (respectIconic) =>
    pool.taxonList.filter((tid) => {
      if (String(tid) === targetId) return false;
      if (!pool.byTaxon.get(String(tid))?.length) return false;
      if (isExcluded(tid)) return false;

      // CONTRAINTE : Le leurre doit avoir le même iconic_taxon_id que la cible
      // Cela évite de mélanger des taxons de groupes complètement différents
      if (respectIconic && targetIconicTaxonId) {
        const rep = pool.byTaxon.get(String(tid))?.[0];
        if (rep?.taxon?.iconic_taxon_id !== targetIconicTaxonId) {
          return false;
        }
      }

      return true;
    });

  const scoreCandidates = (candidateIds) =>
    candidateIds
      .map((tid) => {
        const list = pool.byTaxon.get(String(tid)) || [];
        const rep = list[0] || null;
        if (!rep) return null;
        const anc = Array.isArray(rep?.taxon?.ancestor_ids) ? rep.taxon.ancestor_ids : [];
        const depth = lcaDepth(targetAnc, anc);
        const closeness = depth / targetDepth;
        return { tid: String(tid), rep, depth, closeness };
      })
      .filter(Boolean);

  let candidates = buildCandidates(true);

  // Compute phylogenetic scores for all candidates
  const scored = scoreCandidates(candidates);

  // Stratify by phylogenetic proximity
  const near = [],
    mid = [],
    far = [];
  for (const s of scored) {
    if (s.closeness >= LURE_NEAR_THRESHOLD) near.push(s);
    else if (s.closeness >= LURE_MID_THRESHOLD) mid.push(s);
    else far.push(s);
  }

  // Full Fisher-Yates shuffle within each bucket.
  // The near/mid/far stratification already ensures phylogenetic quality;
  // shuffling fully within each bucket prevents the same high-depth taxon
  // from being systematically picked first every time.
  const shuffleArray = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  shuffleArray(near);
  shuffleArray(mid);
  shuffleArray(far);

  // Apply closeness floor filter directly to the buckets.
  // This is the single authoritative filter — no second pass needed later.
  if (closenessFloor > 0) {
    const applyFloor = (arr) => {
      const filtered = arr.filter((c) => c.closeness >= closenessFloor);
      arr.length = 0;
      arr.push(...filtered);
    };
    applyFloor(near);
    applyFloor(mid);
    applyFloor(far);
  }

  const out = [];
  const pickFromArr = (arr) => {
    // Two-pass: prefer non-recent-lure taxa first, then allow recent ones as fallback
    const preferred = [];
    const fallback = [];
    for (const s of arr) {
      if (seenTaxa.has(s.tid)) continue;
      if (isRecentLure(s.tid)) {
        fallback.push(s);
      } else {
        preferred.push(s);
      }
    }
    for (const s of [...preferred, ...fallback]) {
      if (out.length >= lureCount) return;
      if (seenTaxa.has(s.tid)) continue;
      const obs = pickObservationForTaxon(pool, selectionState, s.tid, { allowSeen: false }, rng)
        || pickObservationForTaxon(pool, selectionState, s.tid, { allowSeen: true }, rng)
        || s.rep;
      if (obs) {
        out.push({ taxonId: s.tid, obs, closeness: s.closeness, depth: s.depth });
        seenTaxa.add(s.tid);
      }
    }
  };

  let lureSource = 'lca-only';

  // HYBRID STRATEGY: Try similar_species API with strict timeout (900ms)
  const cacheKey = `similar:${targetId}`;
  let similarResults = similarSpeciesCache.get(cacheKey, { allowStale: true });
  let similarIds = [];

  if (!similarResults) {
    // Fetch similar species synchronously (with 900ms timeout) so we can
    // actually USE the results for THIS question instead of only warming
    // the cache for a future (typically different) taxon.
    try {
      const fetched = await fetchSimilarSpeciesWithTimeout(targetId, 900);
      if (Array.isArray(fetched) && fetched.length > 0) {
        similarSpeciesCache.set(cacheKey, fetched);
        similarResults = fetched;
      }
    } catch (_) {
      // Timeout or error — fall back to LCA-only silently
    }
  }

  if (Array.isArray(similarResults) && similarResults.length > 0) {
    // API responded successfully - use similar species as primary lures
    lureSource = 'api-hybrid';
    similarIds = Array.from(
      new Set(
        similarResults
          .map((r) => r?.taxon?.id || r?.id || r?.taxon_id)
          .filter(Boolean)
          .map(String)
      )
    ).filter((id) => id !== targetId);

    const scoredMap = new Map(scored.map((s) => [s.tid, s]));

    // Pick from similar species first (only if present in pool and has same iconic_taxon_id)
    // Prefer non-recently-used lures, then allow recent ones as fallback
    const freshSimilar = [];
    const recentSimilar = [];
    for (const sid of similarIds) {
      if (!scoredMap.has(sid)) continue;
      if (isExcluded(sid)) continue;
      if (seenTaxa.has(sid)) continue;
      const s = scoredMap.get(sid);
      if (s.closeness < closenessFloor) continue;
      if (isRecentLure(sid)) {
        recentSimilar.push(s);
      } else {
        freshSimilar.push(s);
      }
    }
    for (const s of [...freshSimilar, ...recentSimilar]) {
      if (out.length >= lureCount) break;
      if (seenTaxa.has(s.tid)) continue;
      const obs = pickObservationForTaxon(pool, selectionState, s.tid, { allowSeen: false }, rng)
        || pickObservationForTaxon(pool, selectionState, s.tid, { allowSeen: true }, rng)
        || s.rep;
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

  const fetchLureObservation = async (taxonId) => {
    if (!taxonId) return null;
    try {
      const resp = await fetchInatJSON(
        'https://api.inaturalist.org/v1/observations',
        {
          taxon_id: taxonId,
          rank: 'species',
          photos: true,
          quality_grade: 'research',
          per_page: 5,
          locale: locale || 'fr',
        },
        { logger, requestId, label: 'lure-obs' }
      );
      const results = Array.isArray(resp?.results) ? resp.results : [];
      for (const item of results) {
        const obs = sanitizeObservation(item);
        if (obs) return obs;
      }
    } catch (_) {
      return null;
    }
    return null;
  };

  const ICONIC_TAXON_ID_TO_NAME = {
    47126: 'Plantae',
    47158: 'Insecta',
    3: 'Aves',
    47170: 'Fungi',
    40151: 'Mammalia',
    26036: 'Reptilia',
    20978: 'Amphibia',
    47178: 'Mollusca',
    47686: 'Arachnida',
    1: 'Animalia',
  };

  const fetchIconicLureObservations = async (iconicName, excludeSet, limit) => {
    if (!iconicName || limit <= 0) return [];
    try {
      const resp = await fetchInatJSON(
        'https://api.inaturalist.org/v1/observations',
        {
          iconic_taxa: iconicName,
          rank: 'species',
          photos: true,
          quality_grade: 'research',
          per_page: Math.min(60, Math.max(20, limit * 10)),
          locale: locale || 'fr',
        },
        { logger, requestId, label: 'lure-iconic' }
      );
      const results = Array.isArray(resp?.results) ? resp.results : [];
      const outObs = [];
      const seen = new Set(Array.from(excludeSet || []));
      for (const item of results) {
        const obs = sanitizeObservation(item);
        if (!obs?.taxon?.id) continue;
        if (isExcluded(obs.taxon.id)) continue;
        const id = String(obs.taxon.id);
        if (seen.has(id)) continue;
        seen.add(id);
        outObs.push(obs);
        if (outObs.length >= limit) break;
      }
      return outObs;
    } catch (_) {
      return [];
    }
  };

  if (allowExternalLures && out.length < lureCount && similarIds.length > 0) {
    const remainingIds = similarIds.filter(
      (id) => !seenTaxa.has(id) && !pool.byTaxon.get(String(id)) && !isExcluded(id)
    );
    for (const id of remainingIds) {
      if (out.length >= lureCount) break;
      const obs = await fetchLureObservation(id);
      if (!obs?.taxon?.id) continue;
      if (isExcluded(obs.taxon.id)) continue;
      if (targetIconicTaxonId && obs.taxon.iconic_taxon_id !== targetIconicTaxonId) {
        continue;
      }
      out.push({ taxonId: String(obs.taxon.id), obs });
      seenTaxa.add(String(obs.taxon.id));
    }
    if (out.length < lureCount) {
      for (const id of remainingIds) {
        if (out.length >= lureCount) break;
        if (seenTaxa.has(id) || isExcluded(id)) continue;
        const obs = await fetchLureObservation(id);
        if (!obs?.taxon?.id) continue;
        if (isExcluded(obs.taxon.id)) continue;
        out.push({ taxonId: String(obs.taxon.id), obs });
        seenTaxa.add(String(obs.taxon.id));
      }
    }
  }

  if (allowExternalLures && out.length < lureCount && targetIconicTaxonId) {
    const iconicName = ICONIC_TAXON_ID_TO_NAME[targetIconicTaxonId];
    if (iconicName) {
      const needed = lureCount - out.length;
      const iconicExclude = excludeTaxonIds
        ? new Set([...excludeTaxonIds, ...seenTaxa])
        : seenTaxa;
      const iconicObs = await fetchIconicLureObservations(iconicName, iconicExclude, needed);
      for (const obs of iconicObs) {
        if (out.length >= lureCount) break;
        out.push({ taxonId: String(obs.taxon.id), obs });
        seenTaxa.add(String(obs.taxon.id));
      }
    }
  }

  // FALLBACK STRATEGY: LCA-only (near/mid/far buckets)
  // Used when API times out, fails, or returns no results
  // Pick from shuffled arrays (already randomized within depth groups)
  if (out.length < lureCount) pickFromArr(near);
  if (out.length < lureCount) pickFromArr(mid);
  if (out.length < lureCount) pickFromArr(far);
  if (out.length < lureCount) {
    const rest = scored.slice();
    // Fisher-Yates shuffle for maximum diversity in final fallback
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    // Then stable-sort by closeness (preserving shuffle order for ties)
    rest.sort((a, b) => b.closeness - a.closeness);
    pickFromArr(rest);
  }

  if (out.length < lureCount && allowMixedIconic) {
    const relaxedCandidates = buildCandidates(false);
    const relaxedScored = scoreCandidates(relaxedCandidates);
    const relaxedNear = [],
      relaxedMid = [],
      relaxedFar = [];
    for (const s of relaxedScored) {
      if (s.closeness >= LURE_NEAR_THRESHOLD) relaxedNear.push(s);
      else if (s.closeness >= LURE_MID_THRESHOLD) relaxedMid.push(s);
      else relaxedFar.push(s);
    }
    shuffleArray(relaxedNear);
    shuffleArray(relaxedMid);
    shuffleArray(relaxedFar);
    if (out.length < lureCount) pickFromArr(relaxedNear);
    if (out.length < lureCount) pickFromArr(relaxedMid);
    if (out.length < lureCount) pickFromArr(relaxedFar);
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
