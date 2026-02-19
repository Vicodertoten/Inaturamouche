// server/services/observationPool.js
// Gestion du pool d'observations depuis iNaturalist

import { config } from '../config/index.js';
import { fetchInatJSON } from './iNaturalistClient.js';
import { questionCache } from '../cache/questionCache.js';
import { buildConfusionMap } from './confusionMap.js';

const {
  maxObsPages,
  distinctTaxaTarget,
  quizChoices,
  degradePoolMaxTaxa,
  degradePoolMaxObsPerTaxon,
} = config;

const CONFUSION_MAP_RETRY_DELAY_MS = 5 * 60 * 1000;
const confusionMapBuildInFlight = new WeakMap();

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
  const ancestors = Array.isArray(taxon.ancestors)
    ? taxon.ancestors
        .filter((ancestor) => ancestor?.id && typeof ancestor?.rank === 'string')
        .map((ancestor) => ({
          id: ancestor.id,
          name: ancestor.name,
          preferred_common_name: ancestor.preferred_common_name,
          rank: ancestor.rank,
        }))
    : [];
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
      common_name: taxon.common_name,
      wikipedia_url: taxon.wikipedia_url,
      url: taxon.url,
      default_photo: taxon.default_photo,
      ancestor_ids: Array.isArray(taxon.ancestor_ids) ? taxon.ancestor_ids : [],
      ancestors,
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
export async function fetchObservationPoolFromInat(
  params,
  monthDayFilter,
  {
    logger,
    requestId,
    rng,
    seed,
    skipTotalProbe = false,
    maxPagesOverride = null,
  } = {}
) {
  let pagesFetched = 0;
  let startPage = 1;
  const random = typeof rng === 'function' ? rng : Math.random;
  const safeMaxPages =
    Number.isInteger(maxPagesOverride) && maxPagesOverride > 0
      ? maxPagesOverride
      : maxObsPages;
  // For seeded games (daily challenge), always start at page 1 to guarantee
  // every user fetches the exact same observations.
  if (!seed && !skipTotalProbe) {
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
  }

  let page = startPage;
  let results = [];
  let distinctTaxaSet = new Set();

  while (pagesFetched < safeMaxPages) {
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

  const hasExplicitTaxa = Boolean(params?.taxon_id);
  // When taxon_id contains multiple IDs (list pack or multi-taxa custom filter),
  // we still need enough distinct taxa for a full quiz (target + lures).
  // Only a single broad taxon (e.g. "3" for Aves) allows minTaxaRequired=1
  // because lures will come from within that broad taxon's observations.
  const explicitTaxaCount = hasExplicitTaxa
    ? String(params.taxon_id).split(',').filter(Boolean).length
    : 0;
  const isMultiTaxaList = explicitTaxaCount > 1;
  const minTaxaRequired = isMultiTaxaList ? quizChoices : (hasExplicitTaxa ? 1 : quizChoices);
  if (taxonList.length < minTaxaRequired) {
    const err = new Error("Pas assez d'espèces différentes pour créer un quiz avec ces critères.");
    err.status = 404;
    throw err;
  }

  // For seeded games, use a deterministic version so that all users
  // share the same selectionState without triggering resets.
  const poolVersion = seed ? 1 : Date.now();

  const pool = {
    timestamp: Date.now(),
    version: poolVersion,
    byTaxon,
    taxonList,
    taxonSet: new Set(taxonList.map(String)),
    observationCount: results.length,
    confusionMap: null, // populated below
    source: 'inat',
  };

  return { pool, pagesFetched, poolObs: results.length, poolTaxa: taxonList.length };
}

function ensureConfusionMapBuild({ pool, cacheKey, logger, requestId }) {
  if (!pool || pool.source === 'degrade-local') return;
  if (pool.confusionMap) return;
  if (!Array.isArray(pool.taxonList) || pool.taxonList.length === 0) return;

  const failedAt = Number(pool.confusionMapFailedAt || 0);
  if (failedAt > 0 && Date.now() - failedAt < CONFUSION_MAP_RETRY_DELAY_MS) {
    return;
  }

  if (confusionMapBuildInFlight.has(pool)) return;

  const buildPromise = (async () => {
    try {
      pool.confusionMap = await buildConfusionMap(pool, { logger, requestId });
      pool.confusionMapFailedAt = null;
    } catch (err) {
      pool.confusionMapFailedAt = Date.now();
      logger?.warn?.(
        { requestId, cacheKey, error: err?.message },
        'Confusion map build failed in background, lures will use LCA-only'
      );
    } finally {
      confusionMapBuildInFlight.delete(pool);
    }
  })();

  confusionMapBuildInFlight.set(pool, buildPromise);
}

function poolStats(pool) {
  if (!pool) return { poolObs: 0, poolTaxa: 0 };
  const poolObs =
    typeof pool.observationCount === 'number'
      ? pool.observationCount
      : Array.from(pool.byTaxon?.values?.() || []).reduce((n, arr) => n + arr.length, 0);
  const poolTaxa = Array.isArray(pool.taxonList) ? pool.taxonList.length : 0;
  return { poolObs, poolTaxa };
}

function parseRequestedTaxonIds(params) {
  const raw = params?.taxon_id;
  if (!raw) return null;
  const ids = String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids.map(String)) : null;
}

function buildDegradePoolFromCache(
  params,
  { ignoreRequestedTaxa = false, minTaxaRequiredOverride = null } = {}
) {
  const entries = Array.from(questionCache.store?.values?.() || []);
  if (!entries.length) return null;

  const requestedTaxonIds = ignoreRequestedTaxa ? null : parseRequestedTaxonIds(params);
  const hasExplicitTaxa = Boolean(params?.taxon_id);
  const explicitTaxaCount = hasExplicitTaxa
    ? String(params.taxon_id).split(',').filter(Boolean).length
    : 0;
  const isMultiTaxaList = explicitTaxaCount > 1;
  const computedMinTaxa = isMultiTaxaList ? quizChoices : (hasExplicitTaxa ? 1 : quizChoices);
  const minTaxaRequired =
    Number.isInteger(minTaxaRequiredOverride) && minTaxaRequiredOverride > 0
      ? minTaxaRequiredOverride
      : computedMinTaxa;
  const maxTaxa = Math.max(minTaxaRequired, degradePoolMaxTaxa);
  const byTaxon = new Map();
  const seenObsIds = new Set();

  for (const entry of entries) {
    const pool = entry?.value;
    if (!pool?.byTaxon) continue;
    for (const [taxonId, observations] of pool.byTaxon.entries()) {
      const key = String(taxonId);
      if (requestedTaxonIds && !requestedTaxonIds.has(key)) continue;
      if (!Array.isArray(observations) || observations.length === 0) continue;
      if (!byTaxon.has(key) && byTaxon.size >= maxTaxa) continue;
      if (!byTaxon.has(key)) byTaxon.set(key, []);
      const target = byTaxon.get(key);
      for (const obs of observations) {
        if (target.length >= degradePoolMaxObsPerTaxon) break;
        if (!obs?.id || seenObsIds.has(String(obs.id))) continue;
        if (!Array.isArray(obs.photos) || obs.photos.length === 0) continue;
        target.push(obs);
        seenObsIds.add(String(obs.id));
      }
      if (target.length === 0) {
        byTaxon.delete(key);
      }
    }
    if (byTaxon.size >= maxTaxa) break;
  }

  const taxonList = Array.from(byTaxon.keys());
  if (taxonList.length < minTaxaRequired) return null;
  const observationCount = Array.from(byTaxon.values()).reduce((acc, list) => acc + list.length, 0);

  return {
    timestamp: Date.now(),
    version: Date.now(),
    byTaxon,
    taxonList,
    taxonSet: new Set(taxonList.map(String)),
    observationCount,
    confusionMap: null, // degrade pool has no confusion map — will use LCA-only fallback
    source: 'degrade-local',
  };
}

/**
 * Get or refresh observation pool with cache management
 */
export async function getObservationPool({
  cacheKey,
  params,
  monthDayFilter,
  logger,
  requestId,
  rng,
  seed,
  skipTotalProbe = false,
  maxPagesOverride = null,
}) {
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

  let fetchedStats = null;
  const fetchFreshPool = async () => {
    const fresh = await fetchObservationPoolFromInat(params, monthDayFilter, {
      logger,
      requestId,
      rng,
      seed,
      skipTotalProbe,
      maxPagesOverride,
    });
    fetchedStats = {
      pagesFetched: fresh.pagesFetched,
      poolObs: fresh.poolObs,
      poolTaxa: fresh.poolTaxa,
    };
    return fresh.pool;
  };

  if (cachedEntry && !cachedEntry.isStale) {
    ensureConfusionMapBuild({ pool: cachedPool, cacheKey, logger, requestId });
    return { pool: cachedPool, pagesFetched: 0, ...poolStats(cachedPool), cacheStatus: 'hit' };
  }

  if (cachedEntry && cachedEntry.isStale) {
    const stalePool = await questionCache.getOrFetch(cacheKey, fetchFreshPool, {
      allowStale: true,
      background: true,
      onError: (err) => logger?.warn({ requestId, error: err?.message }, 'Background pool refresh failed'),
    });
    ensureConfusionMapBuild({ pool: stalePool, cacheKey, logger, requestId });
    return { pool: stalePool, pagesFetched: 0, ...poolStats(stalePool), cacheStatus: 'stale' };
  }

  try {
    const freshPool = await questionCache.getOrFetch(cacheKey, fetchFreshPool, {
      allowStale: false,
      background: false,
    });
    ensureConfusionMapBuild({ pool: freshPool, cacheKey, logger, requestId });
    if (fetchedStats) {
      return { pool: freshPool, ...fetchedStats, cacheStatus: 'miss' };
    }
    return { pool: freshPool, pagesFetched: 0, ...poolStats(freshPool), cacheStatus: 'hit' };
  } catch (err) {
    logger?.warn({ requestId, error: err?.message }, 'Fresh observation pool fetch failed, trying degrade mode');
    const inatUnavailable = err?.code === 'circuit_open' || err?.code === 'timeout';
    let usedCrossPackFallback = false;
    let degradedPool = buildDegradePoolFromCache(params);
    if (!degradedPool && inatUnavailable) {
      degradedPool = buildDegradePoolFromCache(params, {
        ignoreRequestedTaxa: true,
        minTaxaRequiredOverride: quizChoices,
      });
      if (degradedPool) {
        usedCrossPackFallback = true;
        logger?.warn(
          { requestId, cacheKey, requestedTaxa: params?.taxon_id || null },
          'Serving cross-pack degraded pool due iNaturalist outage'
        );
      }
    }
    if (degradedPool) {
      logger?.warn(
        { requestId, cacheKey, taxa: degradedPool.taxonList.length, obs: degradedPool.observationCount },
        'Serving degraded local observation pool'
      );
      if (!usedCrossPackFallback) {
        questionCache.set(cacheKey, degradedPool);
      }
      return { pool: degradedPool, pagesFetched: 0, ...poolStats(degradedPool), cacheStatus: 'degrade' };
    }
    const poolErr = inatUnavailable
      ? new Error("Le service iNaturalist est temporairement indisponible. Réessayez dans quelques instants.")
      : new Error("Pool d'observations indisponible pour ces critères. Réessayez ou élargissez vos filtres.");
    poolErr.status = 503;
    poolErr.code = inatUnavailable ? 'INAT_UNAVAILABLE' : 'POOL_UNAVAILABLE';
    throw poolErr;
  }
}
