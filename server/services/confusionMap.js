// server/services/confusionMap.js
// Pré-calcul d'une carte de confusion pour chaque taxon du pool.
//
// Pour chaque taxon cible, on construit une liste ordonnée de candidats leurres
// scorés par proximité taxonomique (LCA) et similarité visuelle (iNat API).
// Cette map est calculée UNE FOIS au chargement du pool, puis réutilisée
// sans appel réseau à chaque question.

import { lcaDepth } from '../../lib/quiz-utils.js';
import { fetchSimilarSpeciesWithTimeout } from './iNaturalistClient.js';
import { similarSpeciesCache } from '../cache/similarSpeciesCache.js';
import { sanitizeObservation } from './observationPool.js';
import { fetchInatJSON } from './iNaturalistClient.js';

// ── Configuration ──

/** Maximum number of candidates to keep per target taxon */
const MAX_CANDIDATES_PER_TARGET = 15;

/** Minimum candidates desired before attempting external enrichment */
const MIN_CANDIDATES_DESIRED = 6;

/** Batch size for parallel similar_species fetches (throttle iNat API) */
const SIMILAR_FETCH_BATCH_SIZE = 8;

/** Score bonus for taxa that appear in iNat's similar_species results */
const SIMILAR_SPECIES_BONUS = 0.15;

// ── Public API ──

/**
 * Build a confusion map for every taxon in the pool.
 *
 * Returns a Map<string, ScoredCandidate[]> where each key is a target taxon ID
 * and the value is a descending-score list of up to MAX_CANDIDATES_PER_TARGET
 * candidate lure taxa.
 *
 * @typedef {{ tid: string, score: number, closeness: number, source: string, obs?: any }} ScoredCandidate
 *
 * @param {{ taxonList: string[], byTaxon: Map<string, any[]>, taxonSet?: Set<string> }} pool
 * @param {{ logger?: any, requestId?: string, locale?: string }} [options]
 * @returns {Promise<Map<string, ScoredCandidate[]>>}
 */
export async function buildConfusionMap(pool, options = {}) {
  const { logger, requestId, locale = 'fr' } = options;
  const taxonList = pool.taxonList.map(String);

  // ── Step 1 : Fetch similar_species for ALL pool taxa (batched, cached) ──
  const similarMap = await fetchAllSimilarSpecies(taxonList, logger, requestId);

  // ── Step 2 : Build ancestor lookup for fast LCA scoring ──
  const ancestorIndex = buildAncestorIndex(pool);

  // ── Step 3 : Score every (target, candidate) pair ──
  const confusionMap = new Map();

  for (const targetId of taxonList) {
    const targetAnc = ancestorIndex.get(targetId) || [];
    const targetDepth = Math.max(targetAnc.length, 1);
    const targetIconic = getIconicTaxonId(pool, targetId);
    const similarIds = similarMap.get(targetId) || new Set();

    const candidates = [];

    for (const candidateId of taxonList) {
      if (candidateId === targetId) continue;

      const candidateAnc = ancestorIndex.get(candidateId) || [];
      const depth = lcaDepth(targetAnc, candidateAnc);
      const closeness = targetDepth > 0 ? depth / targetDepth : 0;

      // Composite score: LCA closeness + bonus if visually similar
      const bonus = similarIds.has(candidateId) ? SIMILAR_SPECIES_BONUS : 0;
      const score = Math.min(closeness + bonus, 1.0);

      const candidateIconic = getIconicTaxonId(pool, candidateId);
      const sameIconic = targetIconic == null || candidateIconic == null || targetIconic === candidateIconic;

      candidates.push({
        tid: candidateId,
        score,
        closeness,
        source: sameIconic
          ? (similarIds.has(candidateId) ? 'similar+lca' : 'lca')
          : (similarIds.has(candidateId) ? 'similar+lca+cross-iconic' : 'lca+cross-iconic'),
      });
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);

    confusionMap.set(targetId, candidates.slice(0, MAX_CANDIDATES_PER_TARGET));
  }

  // ── Step 4 : Enrich targets with too few candidates (small pools) ──
  await enrichSparseTargets(confusionMap, pool, similarMap, ancestorIndex, {
    logger,
    requestId,
    locale,
  });

  logger?.info?.(
    {
      requestId,
      poolTaxa: taxonList.length,
      mapSize: confusionMap.size,
      avgCandidates: Math.round(
        Array.from(confusionMap.values()).reduce((s, c) => s + c.length, 0) / Math.max(confusionMap.size, 1),
      ),
    },
    'Confusion map built',
  );

  return confusionMap;
}

// ── Internal helpers ──

/**
 * Fetch similar_species for all taxon IDs in parallel batches.
 * Uses the existing similarSpeciesCache (7d/30d TTL).
 *
 * @returns {Promise<Map<string, Set<string>>>} Map from targetId → set of similar taxon IDs
 */
async function fetchAllSimilarSpecies(taxonIds, logger, requestId) {
  const result = new Map();

  // Process in batches to avoid overwhelming the iNat API
  for (let i = 0; i < taxonIds.length; i += SIMILAR_FETCH_BATCH_SIZE) {
    const batch = taxonIds.slice(i, i + SIMILAR_FETCH_BATCH_SIZE);
    const promises = batch.map(async (taxonId) => {
      const ids = await fetchSimilarForOneTaxon(taxonId, logger, requestId);
      return { taxonId, ids };
    });

    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === 'fulfilled') {
        result.set(r.value.taxonId, r.value.ids);
      } else {
        // On failure, set an empty set — LCA scoring still works
        const tid = batch[results.indexOf(r)];
        if (tid) result.set(tid, new Set());
      }
    }
  }

  return result;
}

/**
 * Fetch similar species for a single taxon, with cache.
 */
async function fetchSimilarForOneTaxon(taxonId, logger, requestId) {
  const cacheKey = `similar:${taxonId}`;
  let results = similarSpeciesCache.get(cacheKey, { allowStale: true });

  if (!results) {
    try {
      const fetched = await fetchSimilarSpeciesWithTimeout(taxonId, 900);
      if (Array.isArray(fetched) && fetched.length > 0) {
        similarSpeciesCache.set(cacheKey, fetched);
        results = fetched;
      }
    } catch (err) {
      logger?.debug?.({ requestId, taxonId, err: err?.message }, 'Similar species fetch failed');
    }
  }

  const ids = new Set();
  if (Array.isArray(results)) {
    for (const r of results) {
      const id = r?.taxon?.id || r?.id || r?.taxon_id;
      if (id && String(id) !== String(taxonId)) ids.add(String(id));
    }
  }
  return ids;
}

/**
 * Build a lookup of ancestor IDs for each taxon in the pool.
 */
function buildAncestorIndex(pool) {
  const index = new Map();
  for (const tid of pool.taxonList) {
    const key = String(tid);
    const obs = pool.byTaxon.get(key)?.[0];
    const anc = Array.isArray(obs?.taxon?.ancestor_ids) ? obs.taxon.ancestor_ids : [];
    index.set(key, anc);
  }
  return index;
}

/**
 * Get the iconic_taxon_id for a taxon from the pool.
 */
function getIconicTaxonId(pool, taxonId) {
  const obs = pool.byTaxon.get(String(taxonId))?.[0];
  return obs?.taxon?.iconic_taxon_id || null;
}

/**
 * For targets with fewer than MIN_CANDIDATES_DESIRED in-pool candidates,
 * fetch external species from iNat (same iconic taxon group) and add them
 * to the confusion map with pre-fetched observation data.
 */
async function enrichSparseTargets(confusionMap, pool, similarMap, ancestorIndex, options) {
  const { logger, requestId, locale } = options;
  const sparseTargets = [];

  for (const [targetId, candidates] of confusionMap.entries()) {
    if (candidates.length < MIN_CANDIDATES_DESIRED) {
      sparseTargets.push(targetId);
    }
  }

  if (sparseTargets.length === 0) return;

  logger?.info?.(
    { requestId, sparseCount: sparseTargets.length },
    'Enriching sparse targets with external candidates',
  );

  // Collect unique iconic taxa that need enrichment
  const iconicGroups = new Map(); // iconic_taxon_id → Set<targetId>
  for (const targetId of sparseTargets) {
    const iconic = getIconicTaxonId(pool, targetId);
    if (!iconic) continue;
    if (!iconicGroups.has(iconic)) iconicGroups.set(iconic, new Set());
    iconicGroups.get(iconic).add(targetId);
  }

  const ICONIC_TAXON_ID_TO_NAME = {
    47126: 'Plantae', 47158: 'Insecta', 3: 'Aves', 47170: 'Fungi',
    40151: 'Mammalia', 26036: 'Reptilia', 20978: 'Amphibia',
    47178: 'Mollusca', 47686: 'Arachnida', 1: 'Animalia',
  };

  // Fetch external observations per iconic group
  for (const [iconicId, targetIds] of iconicGroups.entries()) {
    const iconicName = ICONIC_TAXON_ID_TO_NAME[iconicId];
    if (!iconicName) continue;

    // Also collect similar species IDs that are NOT in the pool
    const externalSimilarIds = new Set();
    for (const targetId of targetIds) {
      const sims = similarMap.get(targetId) || new Set();
      for (const sid of sims) {
        if (!pool.taxonSet?.has(sid)) externalSimilarIds.add(sid);
      }
    }

    try {
      // Fetch a batch of external observations from this iconic group
      const resp = await fetchInatJSON(
        'https://api.inaturalist.org/v1/observations',
        {
          iconic_taxa: iconicName,
          rank: 'species',
          photos: true,
          quality_grade: 'research',
          per_page: 40,
          locale: locale || 'fr',
        },
        { logger, requestId, label: 'confusion-map-enrich' },
      );

      const externalObs = (Array.isArray(resp?.results) ? resp.results : [])
        .map((item) => sanitizeObservation(item))
        .filter((obs) => obs?.taxon?.id && !pool.taxonSet?.has(String(obs.taxon.id)));

      // Also try to fetch observations for external similar species
      if (externalSimilarIds.size > 0) {
        const simBatch = Array.from(externalSimilarIds).slice(0, 10);
        const simPromises = simBatch.map(async (sid) => {
          try {
            const r = await fetchInatJSON(
              'https://api.inaturalist.org/v1/observations',
              { taxon_id: sid, rank: 'species', photos: true, quality_grade: 'research', per_page: 3, locale },
              { logger, requestId, label: 'confusion-map-sim-enrich' },
            );
            return (Array.isArray(r?.results) ? r.results : [])
              .map((item) => sanitizeObservation(item))
              .filter(Boolean);
          } catch (_) {
            return [];
          }
        });
        const simResults = await Promise.allSettled(simPromises);
        for (const r of simResults) {
          if (r.status === 'fulfilled') {
            for (const obs of r.value) {
              if (obs?.taxon?.id && !pool.taxonSet?.has(String(obs.taxon.id))) {
                externalObs.push(obs);
              }
            }
          }
        }
      }

      // Deduplicate by taxon ID
      const seenExternal = new Set();
      const uniqueExternalObs = [];
      for (const obs of externalObs) {
        const tid = String(obs.taxon.id);
        if (seenExternal.has(tid)) continue;
        seenExternal.add(tid);
        uniqueExternalObs.push(obs);
      }

      // Score external candidates against each sparse target and add to confusion map
      for (const targetId of targetIds) {
        const existing = confusionMap.get(targetId) || [];
        const existingIds = new Set(existing.map((c) => c.tid));
        const targetAnc = ancestorIndex.get(targetId) || [];
        const targetDepth = Math.max(targetAnc.length, 1);
        const sims = similarMap.get(targetId) || new Set();

        for (const obs of uniqueExternalObs) {
          const tid = String(obs.taxon.id);
          if (tid === targetId || existingIds.has(tid)) continue;

          const anc = Array.isArray(obs.taxon.ancestor_ids) ? obs.taxon.ancestor_ids : [];
          const depth = lcaDepth(targetAnc, anc);
          const closeness = targetDepth > 0 ? depth / targetDepth : 0;
          const bonus = sims.has(tid) ? SIMILAR_SPECIES_BONUS : 0;
          const score = Math.min(closeness + bonus, 1.0);

          existing.push({
            tid,
            score,
            closeness,
            source: sims.has(tid) ? 'external-similar' : 'external',
            obs, // Pre-fetched observation — no API call needed later
          });
          existingIds.add(tid);
        }

        // Re-sort and trim
        existing.sort((a, b) => b.score - a.score);
        confusionMap.set(targetId, existing.slice(0, MAX_CANDIDATES_PER_TARGET));
      }
    } catch (err) {
      logger?.warn?.({ requestId, iconicId, err: err?.message }, 'External enrichment failed');
    }
  }
}
