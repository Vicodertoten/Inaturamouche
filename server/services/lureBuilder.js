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
  } = options;
  const isExcluded = (tid) => excludeTaxonIds && excludeTaxonIds.has(String(tid));

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

  const jitterSort = (arr) => arr.sort((a, b) => b.depth + random() * 0.01 - (a.depth + random() * 0.01));
  jitterSort(near);
  jitterSort(mid);
  jitterSort(far);

  const filterByCloseness = (arr) =>
    closenessFloor > 0 ? arr.filter((candidate) => candidate.closeness >= closenessFloor) : arr;
  const nearPreferred = filterByCloseness(near);
  const midPreferred = filterByCloseness(mid);
  const farPreferred = filterByCloseness(far);

  const out = [];
  const pickFromArr = (arr) => {
    for (const s of arr) {
      if (out.length >= lureCount) return;
      if (seenTaxa.has(s.tid)) continue;
      const obs = pickObservationForTaxon(pool, selectionState, s.tid, { allowSeen: true }, rng) || s.rep;
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
    // Warm cache in background to avoid blocking first-question latency.
    fetchSimilarSpeciesWithTimeout(targetId, 900)
      .then((results) => {
        if (Array.isArray(results) && results.length > 0) {
          similarSpeciesCache.set(cacheKey, results);
        }
      })
      .catch(() => {});
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
    for (const sid of similarIds) {
      if (out.length >= lureCount) break;
      if (!scoredMap.has(sid)) continue;
      if (isExcluded(sid)) continue;
      if (seenTaxa.has(sid)) continue;
      const s = scoredMap.get(sid);
      if (s.closeness < closenessFloor) continue;
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
    47119: 'Fungi',
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

  if (closenessFloor > 0) {
    if (out.length < lureCount) pickFromArr(nearPreferred);
    if (out.length < lureCount) pickFromArr(midPreferred);
    if (out.length < lureCount) pickFromArr(farPreferred);
  }

  // FALLBACK STRATEGY: LCA-only (near/mid/far buckets)
  // Used when API times out, fails, or returns no results
  if (out.length < lureCount && near.length) pickFromArr([near[0]]);
  if (out.length < lureCount && mid.length) pickFromArr([mid[0]]);
  if (out.length < lureCount) pickFromArr(near);
  if (out.length < lureCount) pickFromArr(mid);
  if (out.length < lureCount && far.length) pickFromArr([far[0]]);
  if (out.length < lureCount) pickFromArr(far);
  if (out.length < lureCount) {
    const rest = scored
      .slice()
      .sort((a, b) => b.closeness - a.closeness || b.depth - a.depth || (random() - 0.5) * 0.01);
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
    const relaxedJitter = (arr) =>
      arr.sort((a, b) => b.depth + random() * 0.01 - (a.depth + random() * 0.01));
    relaxedJitter(relaxedNear);
    relaxedJitter(relaxedMid);
    relaxedJitter(relaxedFar);
    if (out.length < lureCount && relaxedNear.length) pickFromArr(relaxedNear);
    if (out.length < lureCount && relaxedMid.length) pickFromArr(relaxedMid);
    if (out.length < lureCount && relaxedFar.length) pickFromArr([relaxedFar[0]]);
    if (out.length < lureCount && relaxedFar.length) pickFromArr(relaxedFar);
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
