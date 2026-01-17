// server/services/observationPool.js
// Gestion du pool d'observations depuis iNaturalist

import { config } from '../config/index.js';
import { fetchInatJSON } from './iNaturalistClient.js';
import { questionCache } from '../cache/questionCache.js';

const { maxObsPages, distinctTaxaTarget, quizChoices } = config;

/**
 * Sanitize an observation from iNaturalist
 * @param {Partial<import("../../types/inaturalist").InatObservation>} obs
 */
export function sanitizeObservation(obs) {
  if (!obs?.taxon?.id) return null;
  const photos = Array.isArray(obs.photos)
    ? obs.photos
        .filter((p) => p?.url)
        .map((p) => ({
          id: p.id,
          attribution: p.attribution,
          url: p.url,
          license_code: p.license_code,
          original_dimensions: p.original_dimensions,
        }))
    : [];
  const sounds = Array.isArray(obs.sounds)
    ? obs.sounds
        .filter((sound) => sound?.file_url)
        .map((sound) => ({
          id: sound.id,
          file_url: sound.file_url,
          attribution: sound.attribution,
          license_code: sound.license_code,
        }))
    : [];

  const taxon = obs.taxon || {};
  return {
    id: obs.id,
    uri: obs.uri,
    photos,
    sounds,
    observedMonthDay: extractMonthDayFromObservation(obs),
    taxon: {
      id: taxon.id,
      name: taxon.name,
      preferred_common_name: taxon.preferred_common_name,
      ancestor_ids: Array.isArray(taxon.ancestor_ids) ? taxon.ancestor_ids : [],
      rank: taxon.rank,
      iconic_taxon_id: taxon.iconic_taxon_id || null,
    },
  };
}

function extractMonthDayFromObservation(obs) {
  const details = obs?.observed_on_details;
  if (details?.month && details?.day) return { month: details.month, day: details.day };
  if (typeof obs?.observed_on === 'string') {
    const parsed = new Date(obs.observed_on);
    if (!Number.isNaN(parsed.getTime())) {
      return { month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate() };
    }
  }
  if (typeof obs?.time_observed_at === 'string') {
    const parsed = new Date(obs.time_observed_at);
    if (!Number.isNaN(parsed.getTime())) {
      return { month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate() };
    }
  }
  return null;
}

/**
 * Fetch observation pool from iNaturalist
 */
export async function fetchObservationPoolFromInat(params, monthDayFilter, { logger, requestId, rng, seed } = {}) {
  let pagesFetched = 0;
  let startPage = 1;
  const random = typeof rng === 'function' ? rng : Math.random;
  try {
    const probeParams = { ...params, per_page: 1, page: 1 };
    const probe = await fetchInatJSON(
      'https://api.inaturalist.org/v1/observations',
      probeParams,
      { logger, requestId, label: 'obs-total-probe' }
    );
    const totalResults = Number(probe?.total_results) || 0;
    if (totalResults > 0) {
      const perPage = Number(params.per_page) || 80;
      const totalPages = Math.max(1, Math.ceil(totalResults / perPage));
      const capped = Math.max(1, Math.min(totalPages, 10));
      startPage = Math.floor(random() * capped) + 1;
    }
  } catch (prefetchErr) {
    logger?.warn({ requestId, error: prefetchErr.message }, 'Observation total prefetch failed');
    startPage = 1;
  }

  let page = startPage;
  let results = [];
  let distinctTaxaSet = new Set();

  while (pagesFetched < maxObsPages) {
    const resp = await fetchInatJSON(
      'https://api.inaturalist.org/v1/observations',
      { ...params, page },
      { logger, requestId }
    );
    const batch = (Array.isArray(resp.results) ? resp.results : [])
      .map((item) => sanitizeObservation(item))
      .filter(Boolean);
    const filteredBatch =
      monthDayFilter?.predicate && typeof monthDayFilter.predicate === 'function'
        ? batch.filter((obs) => monthDayFilter.predicate(obs.observedMonthDay))
        : batch;
    results = results.concat(filteredBatch);
    pagesFetched++;

    distinctTaxaSet = new Set(
      results
        .filter((o) => o?.taxon?.id && Array.isArray(o.photos) && o.photos.length > 0)
        .map((o) => o.taxon.id)
    );

    if (distinctTaxaSet.size >= distinctTaxaTarget) break;
    if (batch.length === 0) break;
    page++;
  }

  if (results.length === 0) {
    const err = new Error(
      'Aucune observation trouvée avec vos critères. Élargissez la zone ou la période.'
    );
    err.status = 404;
    throw err;
  }

  const byTaxon = new Map();
  for (const o of results) {
    const tid = o?.taxon?.id;
    if (!tid) continue;
    if (!Array.isArray(o.photos) || o.photos.length === 0) continue;
    const key = String(tid);
    if (!byTaxon.has(key)) byTaxon.set(key, []);
    byTaxon.get(key).push(o);
  }

  let taxonList = Array.from(byTaxon.keys());
  if (seed) {
    taxonList.sort((a, b) => String(a).localeCompare(String(b)));
  }

  if (taxonList.length < quizChoices) {
    const err = new Error("Pas assez d'espèces différentes pour créer un quiz avec ces critères.");
    err.status = 404;
    throw err;
  }

  const pool = {
    timestamp: Date.now(),
    version: Date.now(),
    byTaxon,
    taxonList,
    taxonSet: new Set(taxonList.map(String)),
    observationCount: results.length,
    source: 'inat',
  };

  return { pool, pagesFetched, poolObs: results.length, poolTaxa: taxonList.length };
}

/**
 * Get or refresh observation pool with cache management
 */
export async function getObservationPool({ cacheKey, params, monthDayFilter, logger, requestId, rng, seed }) {
  questionCache.prune();
  const cachedEntry = questionCache.getEntry(cacheKey);
  const cachedPool = cachedEntry?.value;
  if (cachedPool) {
    if (!cachedPool.version) cachedPool.version = cachedPool.timestamp || Date.now();
    if (!cachedPool.taxonSet && Array.isArray(cachedPool.taxonList)) {
      cachedPool.taxonSet = new Set(cachedPool.taxonList.map(String));
    }
    if (typeof cachedPool.observationCount !== 'number' && cachedPool.byTaxon) {
      cachedPool.observationCount = Array.from(cachedPool.byTaxon.values()).reduce(
        (n, arr) => n + arr.length,
        0
      );
    }
  }

  const poolStatsFromCache = (pool) => ({
    poolObs: pool?.observationCount || Array.from(pool.byTaxon.values()).reduce((n, arr) => n + arr.length, 0),
    poolTaxa: pool?.taxonList?.length || 0,
  });

  const refreshPool = async () => {
    try {
      const fresh = await fetchObservationPoolFromInat(params, monthDayFilter, { logger, requestId, rng, seed });
      questionCache.set(cacheKey, fresh.pool);
      return { ...fresh, cacheStatus: 'miss' };
    } catch (err) {
      // MODE STRICT: Plus de fallback hors-sujet
      // Si l'API est indisponible ou retourne vide, on renvoie une erreur explicite
      logger?.error({ requestId, error: err.message }, 'Observation pool unavailable');
      const poolErr = new Error(
        "Pool d'observations indisponible pour ces critères. Réessayez ou élargissez vos filtres."
      );
      poolErr.status = err?.status || 503;
      poolErr.code = 'POOL_UNAVAILABLE';
      throw poolErr;
    }
  };

  if (cachedEntry && !cachedEntry.isStale) {
    return { pool: cachedPool, pagesFetched: 0, ...poolStatsFromCache(cachedPool), cacheStatus: 'hit' };
  }
  if (cachedEntry && cachedEntry.isStale) {
    refreshPool().catch((err) => {
      logger?.warn({ requestId, error: err.message }, 'Background pool refresh failed');
    });
    return { pool: cachedPool, pagesFetched: 0, ...poolStatsFromCache(cachedPool), cacheStatus: 'stale' };
  }
  return refreshPool();
}
