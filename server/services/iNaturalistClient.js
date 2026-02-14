// server/services/iNaturalistClient.js
// Client pour interagir avec l'API iNaturalist avec retry et circuit breaker

import { config } from '../config/index.js';
import { CircuitBreaker } from '../../lib/smart-cache.js';

const {
  requestTimeoutMs,
  maxRetries,
  inatCircuitFailureThreshold,
  inatCircuitCooldownMs,
  inatCircuitHalfOpenMax,
  inatMaxConcurrentRequests,
  inatBackoffBaseMs,
  inatBackoffMaxMs,
} = config;

// Circuit breaker pour protéger contre les défaillances de l'API iNaturalist
const inatCircuitBreaker = new CircuitBreaker({
  failureThreshold: inatCircuitFailureThreshold,
  cooldownMs: inatCircuitCooldownMs,
  halfOpenMax: inatCircuitHalfOpenMax,
});

let inatInFlight = 0;
const inatWaitQueue = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquireInatSlot() {
  if (inatInFlight < inatMaxConcurrentRequests) {
    inatInFlight += 1;
    return () => {
      inatInFlight = Math.max(0, inatInFlight - 1);
      const next = inatWaitQueue.shift();
      if (next) next();
    };
  }
  await new Promise((resolve) => inatWaitQueue.push(resolve));
  return acquireInatSlot();
}

function parseRetryAfterMs(retryAfterValue) {
  if (!retryAfterValue) return 0;
  const seconds = Number.parseInt(String(retryAfterValue), 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const retryDate = Date.parse(String(retryAfterValue));
  if (Number.isFinite(retryDate)) {
    return Math.max(0, retryDate - Date.now());
  }
  return 0;
}

function computeBackoffMs(attempt, response) {
  const exp = Math.min(inatBackoffMaxMs, inatBackoffBaseMs * Math.pow(2, Math.max(0, attempt)));
  const retryAfterMs =
    response?.status === 429 ? parseRetryAfterMs(response.headers?.get?.('retry-after')) : 0;
  const floor = Math.max(exp, retryAfterMs);
  const jitter = Math.floor(Math.random() * Math.max(20, Math.floor(floor * 0.2)));
  return Math.min(inatBackoffMaxMs, floor + jitter);
}

/**
 * Fetches JSON from iNaturalist with bounded retries and a per-request timeout.
 * - Appends provided query params to the URL.
 * - Aborts the request after `timeoutMs` using AbortController.
 * - Retries on HTTP 5xx or 429 responses with exponential backoff up to `retries`.
 *
 * @param {string | URL} url Base endpoint (iNat URL).
 * @param {Record<string, string | number | boolean | null | undefined>} [params] Query parameters to append.
 * @param {{ timeoutMs?: number, retries?: number, logger?: import("pino").Logger, requestId?: string, label?: string }} [options]
 * @returns {Promise<any>} Parsed JSON response body.
 */
export async function fetchJSON(
  url,
  params = {},
  { timeoutMs = requestTimeoutMs, retries = maxRetries, logger, requestId, label = 'inat' } = {}
) {
  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      urlObj.searchParams.append(key, value);
    }
  }
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    const requestMeta = {
      requestId,
      label,
      url: urlObj.toString(),
      attempt,
    };
    try {
      const releaseSlot = await acquireInatSlot();
      let response;
      try {
        response = await fetch(urlObj, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Inaturamouche/1.0 (+contact: you@example.com)',
          },
        });
      } finally {
        releaseSlot();
      }
      clearTimeout(timer);
      if (!response.ok) {
        if ((response.status >= 500 || response.status === 429) && attempt < retries) {
          attempt++;
          await sleep(computeBackoffMs(attempt, response));
          continue;
        }
        const text = await response.text().catch(() => '');
        const errorMessage = `HTTP ${response.status} ${response.statusText} — ${text.slice(0, 200)}`;
        logger?.warn(
          { ...requestMeta, status: response.status, durationMs: Date.now() - startedAt },
          'iNat fetch failed'
        );
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }
      logger?.debug({ ...requestMeta, durationMs: Date.now() - startedAt }, 'iNat fetch success');
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      if (err?.name === 'AbortError') {
        err.code = 'timeout';
      }
      if (attempt < retries) {
        attempt++;
        logger?.warn({ ...requestMeta, error: err.message }, 'Retrying iNat fetch');
        await sleep(computeBackoffMs(attempt));
        continue;
      }
      logger?.error({ ...requestMeta, error: err.message }, 'iNat fetch exhausted retries');
      throw err;
    }
  }
}

/**
 * Détermine si une erreur doit déclencher le circuit breaker
 * @param {Error} err
 * @returns {boolean}
 */
function shouldTripCircuit(err) {
  const status = err?.status;
  if (status && status >= 500) return true;
  if (status === 429) return true;
  if (err?.code === 'timeout') return true;
  return false;
}

/**
 * Wrapper around iNat fetch with circuit breaker.
 *
 * @param {string | URL} url
 * @param {Record<string, string | number | boolean | null | undefined>} [params]
 * @param {{ timeoutMs?: number, retries?: number, logger?: import("pino").Logger, requestId?: string, label?: string }} [options]
 * @returns {Promise<any>}
 */
export async function fetchInatJSON(url, params = {}, options = {}) {
  if (!inatCircuitBreaker.canRequest()) {
    const err = new Error('iNat circuit open');
    err.code = 'circuit_open';
    throw err;
  }
  try {
    const data = await fetchJSON(url, params, options);
    inatCircuitBreaker.recordSuccess();
    return data;
  } catch (err) {
    if (shouldTripCircuit(err)) inatCircuitBreaker.recordFailure();
    throw err;
  }
}

/**
 * Fetches similar species from iNaturalist API with strict timeout and aggressive caching.
 * Returns empty array on timeout or error (silent fallback).
 * @param {string|number} taxonId
 * @param {number} timeoutMs
 * @returns {Promise<Array>}
 */
export async function fetchSimilarSpeciesWithTimeout(taxonId, timeoutMs = 900) {
  if (!taxonId) return [];

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Similar species API timeout')), timeoutMs);
    });

    const fetchPromise = (async () => {
      const url = new URL('https://api.inaturalist.org/v1/identifications/similar_species');
      url.searchParams.set('taxon_id', String(taxonId));
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        return [];
      }
      if (!res.ok) return [];
      return Array.isArray(data.results)
        ? data.results
        : Array.isArray(data.similar_species)
          ? data.similar_species
          : [];
    })();

    const results = await Promise.race([fetchPromise, timeoutPromise]);

    return results;
  } catch (error) {
    // Silent fallback on timeout or error
    return [];
  }
}

/**
 * Fetches full taxa details with fallback to defaults
 * @param {Array<string|number>} taxonIds
 * @param {string} locale
 * @param {{ logger?: import("pino").Logger, requestId?: string, fallbackDetails?: Map, allowPartial?: boolean }} options
 * @param {import('../cache/taxonDetailsCache.js').TaxonDetailsCache} taxonDetailsCache
 * @returns {Promise<Array>}
 */
export async function getFullTaxaDetails(
  taxonIds,
  locale = 'fr',
  { logger, requestId, fallbackDetails = new Map(), allowPartial = false } = {},
  taxonDetailsCache
) {
  if (!taxonIds || taxonIds.length === 0) return [];
  const requestedIds = taxonIds.map((id) => String(id));
  const uniqueIds = Array.from(new Set(requestedIds));
  const cachedResults = [];
  const staleIds = [];
  const missingIds = [];
  const isMissingObservationCount = (taxon) => taxon?.observations_count == null;

  taxonDetailsCache.prune();

  for (const id of uniqueIds) {
    const entry = taxonDetailsCache.getEntry(`${id}:${locale}`);
    if (entry?.value) {
      cachedResults.push(entry.value);
      if (entry.isStale) staleIds.push(id);
      if (isMissingObservationCount(entry.value)) missingIds.push(id);
    } else {
      missingIds.push(id);
    }
  }

  const idsToFetch = Array.from(new Set([...missingIds, ...staleIds]));
  const mergeLocalizedDefaults = (localizedResults, defaultResults, ids) => {
    const defaultById = new Map(defaultResults.map((t) => [String(t.id), t]));
    const localizedById = new Map(localizedResults.map((t) => [String(t.id), t]));
    return ids
      .map((id) => {
        const loc = localizedById.get(id);
        const def = defaultById.get(id);
        if (loc && def) {
          if (!loc.wikipedia_url && def.wikipedia_url) loc.wikipedia_url = def.wikipedia_url;
          if (!loc.preferred_common_name && def.preferred_common_name)
            loc.preferred_common_name = def.preferred_common_name;
          if (loc.observations_count == null && def.observations_count != null)
            loc.observations_count = def.observations_count;
          if (!loc.conservation_status && def.conservation_status)
            loc.conservation_status = def.conservation_status;
          if (loc.iconic_taxon_id == null && def.iconic_taxon_id != null)
            loc.iconic_taxon_id = def.iconic_taxon_id;
          if (!loc.default_photo && def.default_photo) loc.default_photo = def.default_photo;
          if (!loc.url && def.url) loc.url = def.url;
          return loc;
        }
        return loc || def;
      })
      .filter(Boolean);
  };

  const TAXA_BATCH_LIMIT = 25;
  const chunkIds = (ids, size) => {
    const out = [];
    for (let i = 0; i < ids.length; i += size) {
      out.push(ids.slice(i, i + size));
    }
    return out;
  };

  const fetchBatch = async (ids) => {
    if (!ids.length) return [];
    const chunks = chunkIds(ids, TAXA_BATCH_LIMIT);
    const aggregated = [];

    for (const chunk of chunks) {
      const path = `https://api.inaturalist.org/v1/taxa/${chunk.join(',')}`;
      // Parallelize localized + default fetches to cut iNat latency on cold starts.
      const [localizedResponse, defaultResponse] = await Promise.all([
        fetchInatJSON(path, { locale }, { logger, requestId, label: 'taxa-localized' }),
        locale.startsWith('en')
          ? Promise.resolve(null)
          : fetchInatJSON(path, {}, { logger, requestId, label: 'taxa-default' }),
      ]);
      const localizedResults = Array.isArray(localizedResponse?.results) ? localizedResponse.results : [];
      const defaultResults = Array.isArray(defaultResponse?.results) ? defaultResponse.results : [];
      const merged = mergeLocalizedDefaults(localizedResults, defaultResults, chunk);
      for (const taxon of merged) {
        if (taxon?.id != null) {
          const cacheKey = `${String(taxon.id)}:${locale}`;
          taxonDetailsCache.set(cacheKey, taxon);
        }
      }
      aggregated.push(...merged);
    }

    return aggregated;
  };

  let fetchedResults = [];
  const shouldBackgroundRefresh = idsToFetch.length > 0 && (missingIds.length === 0 || allowPartial);
  if (idsToFetch.length > 0) {
    if (shouldBackgroundRefresh) {
      fetchBatch(idsToFetch).catch((err) => {
        logger?.warn({ requestId, error: err.message }, 'Background taxa refresh failed');
      });
    } else {
      try {
        fetchedResults = await fetchBatch(idsToFetch);
      } catch (err) {
        if (logger) {
          logger.error({ requestId, error: err.message }, 'Erreur getFullTaxaDetails');
        }
      }
    }
  }

  const byId = new Map();
  for (const t of [...cachedResults, ...fetchedResults]) {
    if (t?.id == null) continue;
    byId.set(String(t.id), t);
  }
  for (const [id, fallback] of fallbackDetails.entries()) {
    if (!byId.has(String(id))) byId.set(String(id), fallback);
  }

  const ordered = requestedIds.map((id) => byId.get(id)).filter(Boolean);
  if (ordered.length > 0) return ordered;
  return Array.from(byId.values());
}

export function getTaxonName(t) {
  return t?.preferred_common_name || t?.name || 'Nom introuvable';
}
