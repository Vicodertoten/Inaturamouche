/// <reference path="./types/inaturalist.d.ts" />
// server.js — Inaturamouche (optimisé + observabilité)
// - Helmet avec CSP + Referrer-Policy
// - Pino logs HTTP
// - Rate-limit global + spécifique quiz (~1 req/s)
// - Validation Zod (quiz, autocomplete, species_counts)
// - Endpoint /api/observations/species_counts
// - Healthcheck /healthz
//
// OPTI : on ne fetch les détails (ancestors/wiki) que pour le TAXON CIBLE
// OBS : headers Server-Timing + X-Timing (JSON) + logs Pino par étape

import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import fallbackMushrooms from "./shared/data/common_european_mushrooms.json" with { type: "json" };
import fallbackTrees from "./shared/data/common_european_trees.json" with { type: "json" };
import { findPackById, listPublicPacks } from "./server/packs/index.js";
import {
  buildCacheKey,
  createSeededRandom,
  createShuffledDeck,
  effectiveCooldownN,
  HistoryBuffer,
  lcaDepth,
  drawFromDeck,
  shuffleFisherYates,
} from "./lib/quiz-utils.js";
import { SmartCache, CircuitBreaker } from "./lib/smart-cache.js";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { z } from "zod";
import { performance } from "node:perf_hooks";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const TRUST_PROXY_LIST = process.env.TRUST_PROXY_LIST || "loopback,uniquelocal";
const trustedProxyEntries = TRUST_PROXY_LIST.split(",").map((entry) => entry.trim()).filter(Boolean);

/* -------------------- PROXY -------------------- */
if (trustedProxyEntries.length > 0) {
  app.set("trust proxy", trustedProxyEntries);
}

function getClientIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    ""
  );
}

/* -------------------- CORS -------------------- */
const allowedOrigins = [
  "http://localhost:5173",
  "https://inaturamouche.netlify.app",
  "https://inaturaquizz.netlify.app",
];

const corsOptions = {
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Origin not allowed by CORS"));
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  exposedHeaders: [
    "Content-Length",
    "Content-Type",
    "X-Cache-Key",
    "X-Lures-Relaxed",
    "X-Lure-Buckets",
    "X-Pool-Pages",
    "X-Pool-Obs",
    "X-Pool-Taxa",
    "Server-Timing",
    "X-Timing",
  ],
};

app.use(cors(corsOptions));
app.use((_, res, next) => {
  res.header("Vary", "Origin");
  next();
});

/* -------------------- Sécurité & perfs -------------------- */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "connect-src": ["'self'", "https://api.inaturalist.org", "https://*.wikipedia.org"],
        "img-src": [
          "'self'",
          "data:",
          "https:",
          "https://static.inaturalist.org",
          "https://inaturalist-open-data.s3.amazonaws.com",
        ],
        "media-src": [
          "'self'",
          "https://static.inaturalist.org",
          "https://inaturalist-open-data.s3.amazonaws.com",
        ],
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'", "https:", "data:"],
        "script-src": ["'self'"],
      },
    },
  })
);
app.disable("x-powered-by");
app.set("etag", false);

app.use(compression());
app.use(express.json({ limit: "1mb" }));

/* -------------------- Logs HTTP structurés (Pino) -------------------- */
app.use(
  pinoHttp({
    redact: ["req.headers.authorization", "req.headers.cookie"],
    autoLogging: true,
  })
);

/* -------------------- Rate-limit -------------------- */
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: getClientIp,
  })
);

const quizLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: getClientIp,
});

const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: getClientIp,
});

/* -------------------- Politique de cache -------------------- */
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Vary", "Origin, Accept-Language");
  } else {
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  }
  next();
});

/* -------------------- Constantes & caches -------------------- */
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const QUESTION_CACHE_TTL = 1000 * 60 * 5; // 5 min
const QUESTION_CACHE_STALE_TTL = 1000 * 60 * 15; // 15 min
const AUTOCOMPLETE_CACHE_TTL = 1000 * 60 * 10; // 10 min
const AUTOCOMPLETE_CACHE_STALE_TTL = 1000 * 60 * 60; // 1h
const MAX_CACHE_ENTRIES = 50;
const QUIZ_CHOICES = 4;
const LURE_COUNT = QUIZ_CHOICES - 1;
const TAXON_DETAILS_CACHE_TTL = 1000 * 60 * 60 * 24; // 24h
const TAXON_DETAILS_CACHE_STALE_TTL = 1000 * 60 * 60 * 24 * 7; // 7d
const TAXON_DETAILS_CACHE_MAX = 2000;
const QUESTION_QUEUE_SIZE = 3;
const OBS_HISTORY_LIMIT = 50;
const INAT_CIRCUIT_FAILURE_THRESHOLD = 3;
const INAT_CIRCUIT_COOLDOWN_MS = 15000;
const INAT_CIRCUIT_HALF_OPEN_MAX = 1;

// Cooldown CIBLE (en nombre de questions)
const COOLDOWN_TARGET_N = 60;
// Variante TTL (ms) si souhaitée (null = désactivé)
const COOLDOWN_TARGET_MS = null;

// Extension du pool
const MAX_OBS_PAGES = 1;
const DISTINCT_TAXA_TARGET = 30;

// Seuils proximité des leurres (profondeur LCA normalisée par profondeur cible)
const LURE_NEAR_THRESHOLD = 0.85;
const LURE_MID_THRESHOLD = 0.65;

const questionCache = new SmartCache({
  max: MAX_CACHE_ENTRIES,
  ttl: QUESTION_CACHE_TTL,
  staleTtl: QUESTION_CACHE_STALE_TTL,
});
const autocompleteCache = new SmartCache({
  max: MAX_CACHE_ENTRIES,
  ttl: AUTOCOMPLETE_CACHE_TTL,
  staleTtl: AUTOCOMPLETE_CACHE_STALE_TTL,
});
const SELECTION_STATE_TTL = 1000 * 60 * 10;
const MAX_SELECTION_STATES = 200;
const selectionStateCache = new SmartCache({ max: MAX_SELECTION_STATES, ttl: SELECTION_STATE_TTL });
const taxonDetailsCache = new SmartCache({
  max: TAXON_DETAILS_CACHE_MAX,
  ttl: TAXON_DETAILS_CACHE_TTL,
  staleTtl: TAXON_DETAILS_CACHE_STALE_TTL,
});
const questionQueueCache = new SmartCache({ max: MAX_SELECTION_STATES, ttl: SELECTION_STATE_TTL });
const inatCircuitBreaker = new CircuitBreaker({
  failureThreshold: INAT_CIRCUIT_FAILURE_THRESHOLD,
  cooldownMs: INAT_CIRCUIT_COOLDOWN_MS,
  halfOpenMax: INAT_CIRCUIT_HALF_OPEN_MAX,
});

function createSelectionState(pool, rng) {
  const historyLimit = Math.min(OBS_HISTORY_LIMIT, Math.max(0, (pool?.observationCount || 0) - 1));
  return {
    recentTargetTaxa: [],
    recentTargetSet: new Set(),
    cooldownTarget: COOLDOWN_TARGET_MS ? new Map() : null,
    observationHistory: new HistoryBuffer(historyLimit),
    taxonDeck: createShuffledDeck(pool.taxonList, rng),
    questionIndex: 0,
    version: pool.version,
  };
}

function getSelectionStateForClient(cacheKey, clientId, pool, now, rng) {
  const key = `${cacheKey}|${clientId || "anon"}`;
  let state = selectionStateCache.get(key);
  const historyLimit = Math.min(OBS_HISTORY_LIMIT, Math.max(0, (pool?.observationCount || 0) - 1));
  if (
    !state ||
    !Array.isArray(state.taxonDeck) ||
    state.version !== pool.version
  ) {
    const previousHistory =
      state && state.observationHistory instanceof HistoryBuffer ? state.observationHistory : null;
    const previousQuestionIndex =
      state && Number.isInteger(state.questionIndex) && state.questionIndex >= 0
        ? state.questionIndex
        : 0;
    const nextState = createSelectionState(pool, rng);
    nextState.questionIndex = previousQuestionIndex;
    if (previousHistory) {
      nextState.observationHistory = previousHistory;
      nextState.observationHistory.resize(historyLimit);
    }
    if (state?.recentTargetTaxa?.length && pool?.taxonSet) {
      nextState.recentTargetTaxa = state.recentTargetTaxa.filter((id) => pool.taxonSet.has(String(id)));
      nextState.recentTargetSet = new Set(nextState.recentTargetTaxa.map(String));
    }
    state = nextState;
  }
  if (!(state.observationHistory instanceof HistoryBuffer)) {
    state.observationHistory = new HistoryBuffer(historyLimit);
  } else {
    state.observationHistory.resize(historyLimit);
  }
  if (!Number.isInteger(state.questionIndex) || state.questionIndex < 0) {
    state.questionIndex = 0;
  }
  state.version = pool.version;

  selectionStateCache.set(key, state);
  return { key, state };
}

/* -------------------- Utils -------------------- */
function isValidISODate(s) {
  return typeof s === "string" && !Number.isNaN(Date.parse(s));
}

function normalizeMonthDay(dateString) {
  if (!isValidISODate(dateString)) return null;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return null;
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function extractMonthDayFromObservation(obs) {
  const details = obs?.observed_on_details;
  if (details?.month && details?.day) return { month: details.month, day: details.day };
  if (typeof obs?.observed_on === "string") {
    const parsed = new Date(obs.observed_on);
    if (!Number.isNaN(parsed.getTime())) {
      return { month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate() };
    }
  }
  if (typeof obs?.time_observed_at === "string") {
    const parsed = new Date(obs.time_observed_at);
    if (!Number.isNaN(parsed.getTime())) {
      return { month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate() };
    }
  }
  return null;
}

function buildMonthDayFilter(d1, d2) {
  const start = normalizeMonthDay(d1);
  const end = normalizeMonthDay(d2);
  if (!start && !end) return null;

  const startVal = start ? start.month * 100 + start.day : null;
  const endVal = end ? end.month * 100 + end.day : null;
  const wrapsYear = startVal != null && endVal != null && startVal > endVal;

  const months = new Set();
  const addMonthRange = (from, to) => {
    let m = from;
    while (true) {
      months.add(m);
      if (m === to) break;
      m = (m % 12) + 1;
    }
  };

  if (start && end) {
    addMonthRange(start.month, end.month);
  } else if (start) {
    addMonthRange(start.month, 12);
  } else if (end) {
    addMonthRange(1, end.month);
  }

  const predicate = (md) => {
    if (!md?.month || !md?.day) return false;
    const value = md.month * 100 + md.day;
    if (startVal != null && endVal != null) {
      return wrapsYear ? value >= startVal || value <= endVal : value >= startVal && value <= endVal;
    }
    if (startVal != null) return value >= startVal;
    return value <= endVal;
  };

  return { predicate, months: Array.from(months) };
}

function geoParams(q) {
  const p = {};
  if (q.place_id) {
   const raw = Array.isArray(q.place_id) ? q.place_id.join(",") : String(q.place_id);
   const list = raw.split(",").map(s => s.trim()).filter(Boolean);
   if (list.length) return { p: { place_id: list.join(",") }, mode: "place_id" };
 }
  const hasBbox = [q.nelat, q.nelng, q.swlat, q.swlng].every((v) => v != null);
  if (hasBbox)
    return {
      p: { nelat: q.nelat, nelng: q.nelng, swlat: q.swlat, swlng: q.swlng },
      mode: "bbox",
    };
  return { p: {}, mode: "global" };
}

/**
 * @param {Partial<import("./types/inaturalist").InatObservation>} obs
 */
function sanitizeObservation(obs) {
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
    },
  };
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
async function fetchJSON(
  url,
  params = {},
  { timeoutMs = REQUEST_TIMEOUT_MS, retries = MAX_RETRIES, logger, requestId, label = "inat" } = {}
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
      const response = await fetch(urlObj, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Inaturamouche/1.0 (+contact: you@example.com)",
        },
      });
      clearTimeout(timer);
      if (!response.ok) {
        if ((response.status >= 500 || response.status === 429) && attempt < retries) {
          attempt++;
          await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
          continue;
        }
        const text = await response.text().catch(() => "");
        const errorMessage = `HTTP ${response.status} ${response.statusText} — ${text.slice(0, 200)}`;
        logger?.warn(
          { ...requestMeta, status: response.status, durationMs: Date.now() - startedAt },
          "iNat fetch failed"
        );
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }
      logger?.debug({ ...requestMeta, durationMs: Date.now() - startedAt }, "iNat fetch success");
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      if (err?.name === "AbortError") {
        err.code = "timeout";
      }
      if (attempt < retries) {
        attempt++;
        logger?.warn({ ...requestMeta, error: err.message }, "Retrying iNat fetch");
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
        continue;
      }
      logger?.error({ ...requestMeta, error: err.message }, "iNat fetch exhausted retries");
      throw err;
    }
  }
}

function shouldTripCircuit(err) {
  const status = err?.status;
  if (status && status >= 500) return true;
  if (status === 429) return true;
  if (err?.code === "timeout") return true;
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
async function fetchInatJSON(url, params = {}, options = {}) {
  if (!inatCircuitBreaker.canRequest()) {
    const err = new Error("iNat circuit open");
    err.code = "circuit_open";
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

/* -------------------- iNat helpers -------------------- */
async function getFullTaxaDetails(
  taxonIds,
  locale = "fr",
  { logger, requestId, fallbackDetails = new Map() } = {}
) {
  if (!taxonIds || taxonIds.length === 0) return [];
  const requestedIds = taxonIds.map((id) => String(id));
  const uniqueIds = Array.from(new Set(requestedIds));
  const cachedResults = [];
  const staleIds = [];
  const missingIds = [];

  taxonDetailsCache.prune();

  for (const id of uniqueIds) {
    const entry = taxonDetailsCache.getEntry(`${id}:${locale}`);
    if (entry?.value) {
      cachedResults.push(entry.value);
      if (entry.isStale) staleIds.push(id);
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
          return loc;
        }
        return loc || def;
      })
      .filter(Boolean);
  };

  const fetchBatch = async (ids) => {
    if (!ids.length) return [];
    const path = `https://api.inaturalist.org/v1/taxa/${ids.join(",")}`;
    const localizedResponse = await fetchInatJSON(path, { locale }, { logger, requestId, label: "taxa-localized" });
    const localizedResults = Array.isArray(localizedResponse.results) ? localizedResponse.results : [];
    let defaultResults = [];
    if (!locale.startsWith("en")) {
      const defaultResponse = await fetchInatJSON(path, {}, { logger, requestId, label: "taxa-default" });
      defaultResults = Array.isArray(defaultResponse.results) ? defaultResponse.results : [];
    }
    const merged = mergeLocalizedDefaults(localizedResults, defaultResults, ids);
    for (const taxon of merged) {
      if (taxon?.id != null) {
        const cacheKey = `${String(taxon.id)}:${locale}`;
        taxonDetailsCache.set(cacheKey, taxon);
      }
    }
    return merged;
  };

  let fetchedResults = [];
  const shouldBackgroundRefresh = idsToFetch.length > 0 && missingIds.length === 0;
  if (idsToFetch.length > 0) {
    if (shouldBackgroundRefresh) {
      fetchBatch(idsToFetch).catch((err) => {
        logger?.warn({ requestId, error: err.message }, "Background taxa refresh failed");
      });
    } else {
      try {
        fetchedResults = await fetchBatch(idsToFetch);
      } catch (err) {
        if (logger) {
          logger.error({ requestId, error: err.message }, "Erreur getFullTaxaDetails");
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
function getTaxonName(t) {
  return t?.preferred_common_name || t?.name || "Nom introuvable";
}

const FALLBACK_PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#dfe8e6" offset="0"/><stop stop-color="#c7d4cf" offset="1"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><g fill="#5a6b67" font-family="Arial, sans-serif" font-size="28"><text x="50%" y="48%" text-anchor="middle">Offline pack</text><text x="50%" y="60%" text-anchor="middle" font-size="16">Temporary image</text></g></svg>'
)}`;

const FALLBACK_PACKS = {
  european_mushrooms: fallbackMushrooms,
  european_trees: fallbackTrees,
};
const FALLBACK_PACK_DEFAULT = "european_mushrooms";

function normalizeIdList(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((v) => String(v)).map((v) => v.trim()).filter(Boolean);
  return String(input)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildFallbackPool({ pack_id, taxon_ids, include_taxa, exclude_taxa, seed }) {
  const baseList = FALLBACK_PACKS[pack_id] || [
    ...(FALLBACK_PACKS[FALLBACK_PACK_DEFAULT] || []),
    ...(fallbackTrees || []),
  ];
  const includeSet = new Set(normalizeIdList(taxon_ids || include_taxa));
  const excludeSet = new Set(normalizeIdList(exclude_taxa));

  let filtered = baseList;
  if (includeSet.size) {
    filtered = filtered.filter((item) => includeSet.has(String(item.inaturalist_id)));
  }
  if (excludeSet.size) {
    filtered = filtered.filter((item) => !excludeSet.has(String(item.inaturalist_id)));
  }
  if (filtered.length < QUIZ_CHOICES) {
    const combined = [
      ...(FALLBACK_PACKS[FALLBACK_PACK_DEFAULT] || []),
      ...(fallbackTrees || []),
    ];
    filtered = includeSet.size
      ? combined.filter((item) => includeSet.has(String(item.inaturalist_id)))
      : combined.filter((item) => !excludeSet.has(String(item.inaturalist_id)));
    if (filtered.length < QUIZ_CHOICES) {
      filtered = combined;
    }
  }

  const byTaxon = new Map();
  for (const item of filtered) {
    const taxonId = String(item.inaturalist_id);
    if (!taxonId) continue;
    const obs = {
      id: `fallback-${taxonId}`,
      uri: null,
      photos: [
        {
          id: `fallback-${taxonId}`,
          attribution: "Offline pack",
          license_code: "CC0",
          url: FALLBACK_PLACEHOLDER_IMAGE,
          original_dimensions: { width: 640, height: 360 },
        },
      ],
      sounds: [],
      observedMonthDay: null,
      taxon: {
        id: Number.isFinite(Number(taxonId)) ? Number(taxonId) : taxonId,
        name: item.scientific_name,
        preferred_common_name: item.common_name,
        ancestor_ids: [],
        rank: "species",
      },
    };
    if (!byTaxon.has(taxonId)) byTaxon.set(taxonId, []);
    byTaxon.get(taxonId).push(obs);
  }

  let taxonList = Array.from(byTaxon.keys());
  if (seed) {
    taxonList.sort((a, b) => String(a).localeCompare(String(b)));
  }

  return {
    pool: {
      timestamp: Date.now(),
      version: Date.now(),
      byTaxon,
      taxonList,
      taxonSet: new Set(taxonList.map(String)),
      observationCount: Array.from(byTaxon.values()).reduce((n, arr) => n + arr.length, 0),
      source: "fallback",
    },
    pagesFetched: 0,
    poolObs: Array.from(byTaxon.values()).reduce((n, arr) => n + arr.length, 0),
    poolTaxa: taxonList.length,
  };
}

async function fetchObservationPoolFromInat(params, monthDayFilter, { logger, requestId, rng, seed } = {}) {
  let pagesFetched = 0;
  let startPage = 1;
  const random = typeof rng === "function" ? rng : Math.random;
  try {
    const probeParams = { ...params, per_page: 1, page: 1 };
    const probe = await fetchInatJSON(
      "https://api.inaturalist.org/v1/observations",
      probeParams,
      { logger, requestId, label: "obs-total-probe" }
    );
    const totalResults = Number(probe?.total_results) || 0;
    if (totalResults > 0) {
      const perPage = Number(params.per_page) || 80;
      const totalPages = Math.max(1, Math.ceil(totalResults / perPage));
      const capped = Math.max(1, Math.min(totalPages, 10));
      startPage = Math.floor(random() * capped) + 1;
    }
  } catch (prefetchErr) {
    logger?.warn({ requestId, error: prefetchErr.message }, "Observation total prefetch failed");
    startPage = 1;
  }

  let page = startPage;
  let results = [];
  let distinctTaxaSet = new Set();

  while (pagesFetched < MAX_OBS_PAGES) {
    const resp = await fetchInatJSON(
      "https://api.inaturalist.org/v1/observations",
      { ...params, page },
      { logger, requestId }
    );
    const batch = (Array.isArray(resp.results) ? resp.results : [])
      .map((item) => sanitizeObservation(item))
      .filter(Boolean);
    const filteredBatch =
      monthDayFilter?.predicate && typeof monthDayFilter.predicate === "function"
        ? batch.filter((obs) => monthDayFilter.predicate(obs.observedMonthDay))
        : batch;
    results = results.concat(filteredBatch);
    pagesFetched++;

    distinctTaxaSet = new Set(
      results
        .filter((o) => o?.taxon?.id && Array.isArray(o.photos) && o.photos.length > 0)
        .map((o) => o.taxon.id)
    );

    if (distinctTaxaSet.size >= DISTINCT_TAXA_TARGET) break;
    if (batch.length === 0) break;
    page++;
  }

  if (results.length === 0) {
    const err = new Error(
      "Aucune observation trouvée avec vos critères. Élargissez la zone ou la période."
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

  if (taxonList.length < QUIZ_CHOICES) {
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
    source: "inat",
  };

  return { pool, pagesFetched, poolObs: results.length, poolTaxa: taxonList.length };
}

async function getObservationPool({
  cacheKey,
  params,
  monthDayFilter,
  logger,
  requestId,
  fallbackContext,
  rng,
  seed,
}) {
  questionCache.prune();
  const cachedEntry = questionCache.getEntry(cacheKey);
  const cachedPool = cachedEntry?.value;
  if (cachedPool) {
    if (!cachedPool.version) cachedPool.version = cachedPool.timestamp || Date.now();
    if (!cachedPool.taxonSet && Array.isArray(cachedPool.taxonList)) {
      cachedPool.taxonSet = new Set(cachedPool.taxonList.map(String));
    }
    if (typeof cachedPool.observationCount !== "number" && cachedPool.byTaxon) {
      cachedPool.observationCount = Array.from(cachedPool.byTaxon.values()).reduce((n, arr) => n + arr.length, 0);
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
      return { ...fresh, cacheStatus: "miss" };
    } catch (err) {
      const isUnavailable =
        err?.code === "circuit_open" || err?.code === "timeout" || (err?.status && err.status >= 500);
      if (!isUnavailable) throw err;
      logger?.warn({ requestId, error: err.message }, "Falling back to local packs");
      const fallback = buildFallbackPool(fallbackContext);
      if (fallback.poolTaxa < QUIZ_CHOICES) {
        const fallbackErr = new Error("Pool d'observations indisponible, réessayez.");
        fallbackErr.status = 503;
        throw fallbackErr;
      }
      questionCache.set(cacheKey, fallback.pool);
      return { ...fallback, cacheStatus: "fallback" };
    }
  };

  if (cachedEntry && !cachedEntry.isStale) {
    return { pool: cachedPool, pagesFetched: 0, ...poolStatsFromCache(cachedPool), cacheStatus: "hit" };
  }
  if (cachedEntry && cachedEntry.isStale) {
    refreshPool().catch((err) => {
      logger?.warn({ requestId, error: err.message }, "Background pool refresh failed");
    });
    return { pool: cachedPool, pagesFetched: 0, ...poolStatsFromCache(cachedPool), cacheStatus: "stale" };
  }
  return refreshPool();
}

function getQueueEntry(queueKey) {
  let entry = questionQueueCache.get(queueKey);
  if (!entry || !Array.isArray(entry.queue)) {
    entry = { queue: [], inFlight: null, lastFailureAt: 0 };
  }
  questionQueueCache.set(queueKey, entry);
  return entry;
}

async function fillQuestionQueue(entry, context) {
  if (entry.inFlight) return entry.inFlight;
  entry.inFlight = (async () => {
    while (entry.queue.length < QUESTION_QUEUE_SIZE) {
      try {
        const item = await buildQuizQuestion(context);
        if (item?.payload) {
          entry.queue.push(item);
        } else {
          break;
        }
      } catch (err) {
        entry.lastFailureAt = Date.now();
        break;
      }
    }
  })().finally(() => {
    entry.inFlight = null;
  });
  return entry.inFlight;
}

async function buildQuizQuestion({
  params,
  cacheKey,
  monthDayFilter,
  locale,
  geoMode,
  clientId,
  logger,
  requestId,
  fallbackContext,
  rng,
  poolRng,
  seed,
}) {
  const marks = {};
  marks.start = performance.now();

  const hasSeed = typeof seed === "string" && seed.length > 0;

  const { pool: cacheEntry, pagesFetched, poolObs, poolTaxa } = await getObservationPool({
    cacheKey,
    params,
    monthDayFilter,
    logger,
    requestId,
    fallbackContext,
    rng: poolRng,
    seed: hasSeed ? seed : undefined,
  });

  marks.fetchedObs = performance.now();
  marks.builtIndex = marks.fetchedObs;

  const { state: selectionState } = getSelectionStateForClient(
    cacheKey,
    clientId,
    cacheEntry,
    Date.now(),
    rng
  );
  const questionIndex =
    Number.isInteger(selectionState.questionIndex) && selectionState.questionIndex >= 0
      ? selectionState.questionIndex
      : 0;
  const questionRng = hasSeed ? createSeededRandom(`${seed}|q|${questionIndex}`) : rng;
  const excludeTaxaForTarget = new Set();
  let targetTaxonId = nextEligibleTaxonId(
    cacheEntry,
    selectionState,
    Date.now(),
    excludeTaxaForTarget,
    questionRng,
    { seed: hasSeed ? seed : undefined, questionIndex }
  );

  let selectionMode = "normal";
  if (!targetTaxonId) {
    targetTaxonId = pickRelaxedTaxon(cacheEntry, selectionState, excludeTaxaForTarget, questionRng);
    selectionMode = "fallback_relax";
    logger?.info(
      { cacheKey, mode: selectionMode, pool: cacheEntry.taxonList.length, recentT: cacheEntry.recentTargetTaxa.length },
      "Target fallback relax engaged"
    );
  }
  if (!targetTaxonId) {
    const err = new Error("Pool d'observations indisponible, réessayez.");
    err.status = 503;
    throw err;
  }

  let targetObservation = pickObservationForTaxon(
    cacheEntry,
    selectionState,
    targetTaxonId,
    { allowSeen: false },
    questionRng
  );
  if (!targetObservation) {
    targetObservation = pickObservationForTaxon(
      cacheEntry,
      selectionState,
      targetTaxonId,
      { allowSeen: true },
      questionRng
    );
  }
  if (!targetObservation) {
    const err = new Error("Aucune observation exploitable trouvée pour le taxon cible.");
    err.status = 503;
    throw err;
  }
  rememberObservation(selectionState, targetObservation.id);
  marks.pickedTarget = performance.now();

  const { lures, buckets } = buildLures(
    cacheEntry,
    selectionState,
    targetTaxonId,
    targetObservation,
    LURE_COUNT,
    questionRng
  );
  if (!lures || lures.length < LURE_COUNT) {
    const err = new Error("Pas assez d'espèces différentes pour composer les choix.");
    err.status = 404;
    throw err;
  }
  marks.builtLures = performance.now();

  const choiceIdsInOrder = [String(targetTaxonId), ...lures.map((l) => String(l.taxonId))];
  const fallbackDetails = new Map();
  fallbackDetails.set(String(targetTaxonId), targetObservation?.taxon || {});
  for (const lure of lures) {
    fallbackDetails.set(String(lure.taxonId), lure.obs?.taxon || {});
  }

  const choiceTaxaDetails = await getFullTaxaDetails(choiceIdsInOrder, locale, {
    logger,
    requestId,
    fallbackDetails,
  });
  const details = new Map();
  for (const taxon of choiceTaxaDetails) {
    details.set(String(taxon.id), taxon);
  }
  for (const id of choiceIdsInOrder) {
    const key = String(id);
    if (!details.has(key)) {
      details.set(key, fallbackDetails.get(key) || {});
    }
  }
  const correct = details.get(String(targetTaxonId));
  if (!correct) {
    const err = new Error(`Impossible de récupérer les détails du taxon ${targetTaxonId}`);
    err.status = 502;
    throw err;
  }
  marks.taxaFetched = performance.now();

  const choiceTaxaInfo = choiceIdsInOrder.map((id) => {
    const info = details.get(String(id)) || {};
    return {
      taxon_id: String(id),
      name: info.name || info.taxon?.name,
      preferred_common_name: info.preferred_common_name || info.common_name || null,
      rank: info.rank,
    };
  });

  const labelsInOrder = makeChoiceLabels(details, choiceIdsInOrder);
  const choiceObjects = choiceIdsInOrder.map((id, idx) => ({ taxon_id: id, label: labelsInOrder[idx] }));
  const shuffledChoices = shuffleFisherYates(choiceObjects, questionRng);
  const correct_choice_index = shuffledChoices.findIndex((c) => c.taxon_id === String(targetTaxonId));
  const correct_label = shuffledChoices[correct_choice_index]?.label || getTaxonName(correct);

  const facilePairs = choiceIdsInOrder.map((id) => ({
    taxon_id: id,
    label: getTaxonName(details.get(String(id))),
  }));
  const facileShuffled = shuffleFisherYates(facilePairs, questionRng);
  const choix_mode_facile = facileShuffled.map((p) => p.label);
  const choix_mode_facile_ids = facileShuffled.map((p) => p.taxon_id);
  const choix_mode_facile_correct_index = choix_mode_facile_ids.findIndex(
    (id) => id === String(targetTaxonId)
  );
  marks.labelsMade = performance.now();

  const observationPhotos = Array.isArray(targetObservation.photos) ? targetObservation.photos : [];
  const image_urls = observationPhotos
    .map((p) => (p?.url ? p.url.replace("square", "large") : null))
    .filter(Boolean);
  const image_meta = observationPhotos.map((p, idx) => ({
    id: p.id ?? idx,
    attribution: p.attribution,
    license_code: p.license_code,
    url: p.url,
    original_dimensions: p.original_dimensions,
  }));

  pushTargetCooldown(cacheEntry, selectionState, [String(targetTaxonId)], Date.now());

  marks.end = performance.now();
  selectionState.questionIndex = questionIndex + 1;
  const { timing, serverTiming, xTiming } = buildTimingData(marks, { pagesFetched, poolObs, poolTaxa });

  logger?.info(
    {
      cacheKey,
      selectionMode,
      pagesFetched,
      poolObs,
      poolTaxa,
      timings: timing,
      targetTaxonId: String(targetTaxonId),
      targetObsId: String(targetObservation.id),
    },
    "Quiz timings"
  );

  return {
    payload: {
      image_urls,
      image_meta,
      sounds: targetObservation.sounds || [],
      bonne_reponse: {
        id: correct.id,
        name: correct.name,
        preferred_common_name: correct.preferred_common_name || correct.common_name || null,
        common_name: getTaxonName(correct),
        ancestors: Array.isArray(correct.ancestors) ? correct.ancestors : [],
        ancestor_ids: correct.ancestor_ids,
        iconic_taxon_id: correct.iconic_taxon_id,
        wikipedia_url: correct.wikipedia_url,
      },
      choices: shuffledChoices,
      correct_choice_index,
      correct_label,
      choice_taxa_details: choiceTaxaInfo,
      choix_mode_facile,
      choix_mode_facile_ids,
      choix_mode_facile_correct_index,
      inaturalist_url: targetObservation.uri,
    },
    headers: {
      "X-Cache-Key": cacheKey,
      "X-Lures-Relaxed": selectionMode === "fallback_relax" ? "1" : "0",
      "X-Lure-Buckets": `${buckets.near}|${buckets.mid}|${buckets.far}`,
      "X-Pool-Pages": String(pagesFetched),
      "X-Pool-Obs": String(poolObs),
      "X-Pool-Taxa": String(poolTaxa),
      "X-Selection-Geo": geoMode,
      "Server-Timing": serverTiming,
      "X-Timing": xTiming,
    },
  };
}

/* -------------------- Helpers ABCD -------------------- */
function rememberObservation(selectionState, obsId) {
  if (!selectionState?.observationHistory) return;
  selectionState.observationHistory.add(String(obsId));
}
function hasEligibleObservation(pool, selectionState, taxonId) {
  const list = pool.byTaxon.get(String(taxonId)) || [];
  if (!list.length) return false;
  if (!selectionState?.observationHistory) return true;
  return list.some((obs) => !selectionState.observationHistory.has(String(obs.id)));
}
function pickObservationForTaxon(pool, selectionState, taxonId, { allowSeen = false } = {}, rng = Math.random) {
  const list = pool.byTaxon.get(String(taxonId)) || [];
  if (list.length === 0) return null;
  const filtered =
    selectionState?.observationHistory && !allowSeen
      ? list.filter((o) => !selectionState.observationHistory.has(String(o.id)))
      : list.slice();
  if (!filtered.length) return null;
  const random = typeof rng === "function" ? rng : Math.random;
  return filtered[Math.floor(random() * filtered.length)];
}

// Cooldown cible
function purgeTTLMap(ttlMap, now) {
  if (!ttlMap) return;
  for (const [k, exp] of ttlMap.entries()) {
    if (exp <= now) ttlMap.delete(k);
  }
}
function isBlockedByTargetCooldown(selectionState, taxonId, now) {
  const id = String(taxonId);
  if (COOLDOWN_TARGET_MS && selectionState.cooldownTarget) {
    purgeTTLMap(selectionState.cooldownTarget, now);
    if (selectionState.cooldownTarget.has(id)) return true;
  }
  if (selectionState.recentTargetSet.has(id)) return true;
  return false;
}
function pushTargetCooldown(pool, selectionState, taxonIds, now) {
  const ids = taxonIds.map(String);
  if (COOLDOWN_TARGET_MS && selectionState.cooldownTarget) {
    const exp = now + COOLDOWN_TARGET_MS;
    for (const id of ids) selectionState.cooldownTarget.set(id, exp);
  } else {
    for (const id of ids) {
      if (!selectionState.recentTargetSet.has(id)) {
        selectionState.recentTargetTaxa.unshift(id);
        selectionState.recentTargetSet.add(id);
      }
    }
    const limit = effectiveCooldownN(COOLDOWN_TARGET_N, pool.taxonList.length, QUIZ_CHOICES);
    while (selectionState.recentTargetTaxa.length > limit) {
      const removed = selectionState.recentTargetTaxa.pop();
      selectionState.recentTargetSet.delete(removed);
    }
  }
}

// Sans-remise corrigé
/**
 * Selects the next target taxon id using a shuffle-with-cursor draw so taxa are not repeated until the deck recycles.
 * - Keeps a shuffled array per client; only advances the cursor when the candidate is eligible.
 * - Eligibility excludes taxa without observations, already drawn targets under cooldown, and any explicit exclusions.
 * - When the cursor reaches the end, it reshuffles remaining items to prevent order bias.
 *
 * @param {{ taxonList: (string|number)[], byTaxon: Map<string, any[]> }} pool Current observation pool keyed by taxon id.
 * @param {ReturnType<typeof createSelectionState>} selectionState Per-client selection data (cursor, shuffledTaxonIds, cooldown).
 * @param {number} now Milliseconds timestamp for TTL eviction.
 * @param {Set<string>} [excludeSet] Optional explicit blocklist (e.g., taxa used as lures).
 * @param {() => number} [rng] Optional RNG for deterministic selection.
 * @returns {string|null} Eligible taxon id or null if none available.
 */
function nextEligibleTaxonId(
  pool,
  selectionState,
  now,
  excludeSet = new Set(),
  rng = Math.random,
  { seed, questionIndex } = {}
) {
  if (seed && pool.taxonList?.length > 0) {
    const index = questionIndex % pool.taxonList.length;
    const taxonId = pool.taxonList[index];
    return String(taxonId);
  }

  if (!Array.isArray(selectionState.taxonDeck) || selectionState.taxonDeck.length === 0) {
    selectionState.taxonDeck = createShuffledDeck(pool.taxonList, rng);
  }
  const maxAttempts = pool.taxonList.length;
  if (maxAttempts === 0) return null;

  const isEligible = (tid) => {
    const key = String(tid);
    if (excludeSet.has(key)) return false;
    if (!pool.byTaxon.get(key)?.length) return false;
    if (!hasEligibleObservation(pool, selectionState, key)) return false;
    if (isBlockedByTargetCooldown(selectionState, key, now)) return false;
    return true;
  };

  let attempts = 0;
  while (attempts < maxAttempts) {
    if (!selectionState.taxonDeck.length) {
      selectionState.taxonDeck = createShuffledDeck(pool.taxonList, rng);
    }
    const tid = drawFromDeck(selectionState.taxonDeck, rng);
    if (tid == null) return null;
    if (isEligible(tid)) return String(tid);
    attempts += 1;
  }
  return null;
}

// Fallback relax (pondéré par ancienneté) — cible
function pickRelaxedTaxon(pool, selectionState, excludeSet = new Set(), rng = Math.random) {
  const all = pool.taxonList.filter(
    (t) =>
      !excludeSet.has(String(t)) &&
      pool.byTaxon.get(String(t))?.length &&
      hasEligibleObservation(pool, selectionState, String(t))
  );
  if (all.length === 0) return null;
  const random = typeof rng === "function" ? rng : Math.random;

  const weightFor = (id) => {
    const s = String(id);
    const idxT = selectionState.recentTargetTaxa.indexOf(s);
    if (idxT === -1) return 5;
    const lenT = selectionState.recentTargetTaxa.length;
    return Math.max(1, lenT - idxT);
  };

  const weights = all.map(weightFor);
  const total = weights.reduce((a, b) => a + b, 0) || all.length;
  let r = random() * total;
  for (let i = 0; i < all.length; i++) {
    r -= weights[i];
    if (r <= 0) return String(all[i]);
  }
  return String(all[all.length - 1]);
}

// Labels uniques pour le mode "choices" (non-facile)
function makeChoiceLabels(detailsMap, ids) {
  const base = ids.map((id) => {
    const d = detailsMap.get(String(id));
    const common = getTaxonName(d);
    const sci = d?.name || "sp.";
    return `${common} (${sci})`;
  });
  const seen = new Map();
  return base.map((label, i) => {
    if (!seen.has(label)) {
      seen.set(label, 1);
      return label;
    }
    const id = String(ids[i]);
    const newLabel = `${label} [#${id}]`;
    seen.set(newLabel, 1);
    return newLabel;
  });
}

/* ---------- Leurres équilibrés par LCA (near/mid/far) ---------- */
/**
 * Builds lure observations stratified by phylogenetic proximity using Lowest Common Ancestor depth.
 * Closeness = LCA_depth(candidate, target) / target_depth:
 * - >= LURE_NEAR_THRESHOLD (0.85): near, visually confusable (same genus/family).
 * - >= LURE_MID_THRESHOLD (0.65): mid, same order/class.
 * - else: far, ensures coverage of distant clades.
 * Starts by picking the top item of each bucket, then backfills while avoiding duplicates and expired observations.
 *
 * @param {{ taxonList: (string|number)[], byTaxon: Map<string, any[]> }} pool Observation pool indexed by taxon id.
 * @param {ReturnType<typeof createSelectionState>} selectionState Tracks recently used observations per client.
 * @param {string|number} targetTaxonId Taxon id of the correct answer.
 * @param {any} targetObservation Representative observation for the target (provides ancestor_ids).
 * @param {number} [lureCount=LURE_COUNT] Number of lures to produce (default 3 for 4-choice quiz).
 * @param {() => number} [rng] Optional RNG for deterministic lure ordering.
 * @returns {{ lures: Array<{ taxonId: string, obs: any }>, buckets: { near: number, mid: number, far: number } }}
 */
function buildLures(pool, selectionState, targetTaxonId, targetObservation, lureCount = LURE_COUNT, rng = Math.random) {
  const targetId = String(targetTaxonId);
  const seenTaxa = new Set([targetId]);
  const random = typeof rng === "function" ? rng : Math.random;

  const targetAnc = Array.isArray(targetObservation?.taxon?.ancestor_ids)
    ? targetObservation.taxon.ancestor_ids
    : [];
  const targetDepth = Math.max(targetAnc.length, 1);

  const candidates = pool.taxonList
    .filter((tid) => String(tid) !== targetId && pool.byTaxon.get(String(tid))?.length);

  const scored = candidates.map((tid) => {
    const list = pool.byTaxon.get(String(tid)) || [];
    const rep = list[0] || null;
    const anc = Array.isArray(rep?.taxon?.ancestor_ids) ? rep.taxon.ancestor_ids : [];
    const depth = lcaDepth(targetAnc, anc);
    const closeness = depth / targetDepth; // 0..1
    return { tid: String(tid), rep, depth, closeness };
  });

  const near = [], mid = [], far = [];
  for (const s of scored) {
    if (s.closeness >= LURE_NEAR_THRESHOLD) near.push(s);
    else if (s.closeness >= LURE_MID_THRESHOLD) mid.push(s);
    else far.push(s);
  }

  const jitterSort = (arr) =>
    arr.sort((a, b) => (b.depth + random() * 0.01) - (a.depth + random() * 0.01));
  jitterSort(near); jitterSort(mid); jitterSort(far);

  const out = [];
  const pickFromArr = (arr) => {
    for (const s of arr) {
      if (out.length >= lureCount) return;
      if (seenTaxa.has(s.tid)) continue;
      const obs =
        pickObservationForTaxon(pool, selectionState, s.tid, { allowSeen: true }, rng) || s.rep;
      if (obs) {
        out.push({ taxonId: s.tid, obs });
        seenTaxa.add(s.tid);
      }
    }
  };

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
  };
}

/* -------------------- Validation (Zod) -------------------- */
const stringOrArray = z.union([z.string(), z.array(z.string())]);

const quizSchema = z.object({
  pack_id: z.string().optional(),
  taxon_ids: stringOrArray.optional(),
  include_taxa: stringOrArray.optional(),
  exclude_taxa: stringOrArray.optional(),
  place_id: z.union([z.string(), z.array(z.string())]).optional(),
  nelat: z.coerce.number().min(-90).max(90).optional(),
  nelng: z.coerce.number().min(-180).max(180).optional(),
  swlat: z.coerce.number().min(-90).max(90).optional(),
  swlng: z.coerce.number().min(-180).max(180).optional(),
  d1: z.string().optional(),
  d2: z.string().optional(),
  seed: z.string().optional(),
  seed_session: z.string().optional(),
  locale: z.string().default("fr"),
  media_type: z.enum(["images", "sounds", "both"]).optional(),
});

const autocompleteSchema = z.object({
  q: z.string().min(2),
  rank: z.string().optional(),
  locale: z.string().default("fr"),
});

const speciesCountsSchema = z.object({
  taxon_ids: stringOrArray.optional(),
  include_taxa: stringOrArray.optional(),
  exclude_taxa: stringOrArray.optional(),
  place_id: z.string().optional(),
  nelat: z.coerce.number().min(-90).max(90).optional(),
  nelng: z.coerce.number().min(-180).max(180).optional(),
  swlat: z.coerce.number().min(-90).max(90).optional(),
  swlng: z.coerce.number().min(-180).max(180).optional(),
  d1: z.string().optional(),
  d2: z.string().optional(),
  locale: z.string().default("fr"),
  per_page: z.coerce.number().min(1).max(200).default(100),
  page: z.coerce.number().min(1).max(500).default(1),
});

const placesSchema = z.object({
  q: z.string().trim().min(2).max(80),
  per_page: z.coerce.number().min(1).max(25).default(15),
});

const csvIds = (maxItems) =>
  z
    .string()
    .min(1)
    .max(500)
    .transform((value) =>
      String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .refine((list) => list.length > 0 && list.length <= maxItems, {
      message: `Entre 1 et ${maxItems} identifiants sont requis`,
    });

const placesByIdSchema = z.object({
  ids: csvIds(25),
});

const taxaBatchSchema = z.object({
  ids: csvIds(100),
  locale: z.string().default("fr"),
});

// ⚠️ Express 5: req.query est en lecture seule
function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse({ ...req.query, ...req.body });
    if (!parsed.success) return res.status(400).json({ error: "Bad request", issues: parsed.error.issues });
    req.valid = parsed.data;
    next();
  };
}

/* -------------------- Helper observabilité -------------------- */
function buildTimingData(marks, extra = {}) {
  const ms = (a, b) => Math.max(0, Math.round((marks[b] - marks[a]) || 0));
  const total = Math.max(0, Math.round((marks.end - marks.start) || 0));
  const timing = {
    fetchObsMs: ms("start", "fetchedObs"),
    buildIndexMs: ms("fetchedObs", "builtIndex"),
    pickTargetMs: ms("builtIndex", "pickedTarget"),
    buildLuresMs: ms("pickedTarget", "builtLures"),
    taxaDetailsMs: ms("builtLures", "taxaFetched"),
    labelsMs: ms("taxaFetched", "labelsMade"),
    totalMs: total,
    ...extra,
  };
  const serverTiming =
    `fetchObs;dur=${timing.fetchObsMs}, ` +
    `buildIndex;dur=${timing.buildIndexMs}, ` +
    `pickTarget;dur=${timing.pickTargetMs}, ` +
    `buildLures;dur=${timing.buildLuresMs}, ` +
    `taxa;dur=${timing.taxaDetailsMs}, ` +
    `labels;dur=${timing.labelsMs}, ` +
    `total;dur=${timing.totalMs}`;
  return { timing, serverTiming, xTiming: JSON.stringify(timing) };
}

function setTimingHeaders(res, marks, extra = {}) {
  const { timing, serverTiming, xTiming } = buildTimingData(marks, extra);
  res.set("X-Timing", xTiming);
  res.set("Server-Timing", serverTiming);
  return timing;
}

/* -------------------- Routes -------------------- */

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.get("/api/packs", (req, res) => {
  res.json(listPublicPacks());
});

// Génération d’une question
app.get(
  "/api/quiz-question",
  quizLimiter,
  validate(quizSchema),
  async (req, res) => {
    try {
      const {
        pack_id,
        taxon_ids,
        include_taxa,
        exclude_taxa,
        place_id,
        nelat,
        nelng,
        swlat,
        swlng,
        d1,
        d2,
        seed,
        seed_session,
        locale = "fr",
        media_type,
      } = req.valid;

      const normalizedSeed = typeof seed === "string" ? seed.trim() : "";
      const hasSeed = normalizedSeed.length > 0;
      const rng = hasSeed ? createSeededRandom(normalizedSeed) : undefined;
      const poolRng = hasSeed ? createSeededRandom(`${normalizedSeed}|pool`) : undefined;
      const normalizedSeedSession = typeof seed_session === "string" ? seed_session.trim() : "";

      const geo = hasSeed ? { p: {}, mode: "global" } : geoParams({ place_id, nelat, nelng, swlat, swlng });
      const params = {
        quality_grade: "research",
        photos: true,
        rank: "species",
        per_page: 80,
        locale,
        ...geo.p,
      };
      if (!hasSeed && (media_type === "sounds" || media_type === "both")) {
        params.sounds = true;
      }
      const monthDayFilter = hasSeed ? null : buildMonthDayFilter(d1, d2);

      if (pack_id) {
        const selectedPack = findPackById(pack_id);
        if (!selectedPack) {
          return res.status(400).json({ error: "Pack inconnu" });
        }
        if (selectedPack.type === "list" && Array.isArray(selectedPack.taxa_ids)) {
          params.taxon_id = selectedPack.taxa_ids.join(",");
        } else if (selectedPack.api_params) {
          Object.assign(params, selectedPack.api_params);
        }
      } else if (taxon_ids) {
        params.taxon_id = Array.isArray(taxon_ids) ? taxon_ids.join(",") : taxon_ids;
      } else if (include_taxa || exclude_taxa) {
        if (include_taxa) params.taxon_id = Array.isArray(include_taxa) ? include_taxa.join(",") : include_taxa;
        if (exclude_taxa) params.without_taxon_id = Array.isArray(exclude_taxa) ? exclude_taxa.join(",") : exclude_taxa;
      }

      if (hasSeed) {
        delete params.place_id;
        delete params.nelat;
        delete params.nelng;
        delete params.swlat;
        delete params.swlng;
      }

      if (!hasSeed) {
        if (monthDayFilter?.months?.length) {
          params.month = monthDayFilter.months.join(",");
        } else {
          if (d1 && isValidISODate(d1)) params.d1 = d1;
          if (d2 && isValidISODate(d2)) params.d2 = d2;
        }
      }
      const cacheKeyParams = { ...params };
      if (monthDayFilter) {
        cacheKeyParams.d1 = d1 || "";
        cacheKeyParams.d2 = d2 || "";
      }
      if (hasSeed) {
        cacheKeyParams.seed = normalizedSeed;
      }

      const cacheKey = buildCacheKey(cacheKeyParams);
      selectionStateCache.prune();
      questionQueueCache.prune();
      const clientIp = getClientIp(req);
      const clientKey =
        hasSeed && normalizedSeedSession
          ? `${clientIp || "anon"}|${normalizedSeedSession}`
          : clientIp;
      const queueKey = `${cacheKey}|${clientKey || "anon"}`;
      const context = {
        params,
        cacheKey,
        monthDayFilter,
        locale,
        geoMode: geo.mode,
        clientId: clientKey,
        logger: req.log,
        requestId: req.id,
        fallbackContext: hasSeed ? { seed: normalizedSeed } : { pack_id, taxon_ids, include_taxa, exclude_taxa },
        rng,
        poolRng,
        seed: hasSeed ? normalizedSeed : "",
      };

      const queueEntry = getQueueEntry(queueKey);
      let item = queueEntry.queue.shift();
      if (!item) {
        item = await buildQuizQuestion(context);
      }
      if (!item?.payload) {
        return res.status(503).json({ error: "Pool d'observations indisponible, réessayez." });
      }
      if (item.headers) {
        for (const [key, value] of Object.entries(item.headers)) {
          res.set(key, value);
        }
      }
      res.json(item.payload);

      fillQuestionQueue(queueEntry, context).catch((err) => {
        req.log?.warn({ err, requestId: req.id }, "Background queue fill failed");
      });
    } catch (err) {
      req.log?.error({ err, requestId: req.id }, "Unhandled quiz route error");
      if (res.headersSent) return;
      const status = err?.status || 500;
      let message =
        status === 500 ? "Erreur interne du serveur" : err?.message || "Erreur interne du serveur";
      if (err?.code === "timeout") {
        message = "Le service iNaturalist est lent ou indisponible, réessayez dans quelques instants.";
      }
      res.status(status).json({ error: message });
    }
  }
);

// --- AUTOCOMPLETE PLACES ---
app.get(
  "/api/places",
  proxyLimiter,
  validate(placesSchema),
  async (req, res) => {
    try {
      const { q, per_page } = req.valid;
      const cacheKey = buildCacheKey({ places: q, per_page });
      autocompleteCache.prune();
      const out = await autocompleteCache.getOrFetch(
        cacheKey,
        async () => {
          const data = await fetchInatJSON(
            "https://api.inaturalist.org/v1/places/autocomplete",
            { q, per_page },
            { logger: req.log, requestId: req.id, label: "places-autocomplete" }
          );
          return (data.results || []).map((p) => ({
            id: p.id,
            name: p.display_name || p.name,
            type: p.place_type_name,
            admin_level: p.admin_level,
            area_km2: p.bounding_box_area,
          }));
        },
        {
          allowStale: true,
          background: true,
          onError: (err) => req.log?.warn({ requestId: req.id, error: err.message }, "places cache refresh failed"),
        }
      );
      res.json(out);
    } catch (e) {
      req.log?.error({ err: e, requestId: req.id }, "Unhandled places autocomplete error");
      res.status(500).json([]);
    }
  }
);

app.get(
  "/api/places/by-id",
  proxyLimiter,
  validate(placesByIdSchema),
  async (req, res) => {
    try {
      const idsParam = req.valid.ids.join(",");
      if (!idsParam) return res.json([]);
      const data = await fetchInatJSON(`https://api.inaturalist.org/v1/places/${idsParam}`, {}, {
        logger: req.log,
        requestId: req.id,
        label: "places-by-id",
      });
      const arr = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const out = arr.map((p) => ({
        id: p.id,
        name: p.display_name || p.name,
        type: p.place_type_name,
        admin_level: p.admin_level,
        area_km2: p.bounding_box_area,
      }));
      res.json(out);
    } catch (e) {
      req.log?.error({ err: e, requestId: req.id }, "Unhandled places by id error");
      res.status(500).json([]);
    }
  }
);

// Autocomplete taxons
app.get(
  "/api/taxa/autocomplete",
  validate(autocompleteSchema),
  async (req, res) => {
    try {
      const { q, rank, locale = "fr" } = req.valid;
      autocompleteCache.prune();
      const cacheKey = buildCacheKey({ q: String(q).trim(), rank, locale });
      const out = await autocompleteCache.getOrFetch(
        cacheKey,
        async () => {
          const params = { q: String(q).trim(), is_active: true, per_page: 10, locale };
          if (rank) params.rank = rank;

          const response = await fetchInatJSON("https://api.inaturalist.org/v1/taxa/autocomplete", params, {
            logger: req.log,
            requestId: req.id,
            label: "taxa-autocomplete",
          });
          const initial = Array.isArray(response.results) ? response.results : [];
          if (initial.length === 0) {
            return [];
          }

          const taxonIds = initial.map((t) => t.id);
          const taxaDetails = await getFullTaxaDetails(taxonIds, locale, { logger: req.log, requestId: req.id });
          const byId = new Map(taxaDetails.map((t) => [t.id, t]));

          return initial.map((t) => {
            const d = byId.get(t.id);
            return {
              id: t.id,
              name: t.preferred_common_name ? `${t.preferred_common_name} (${t.name})` : t.name,
              rank: t.rank,
              ancestor_ids: Array.isArray(d?.ancestors) ? d.ancestors.map((a) => a.id) : [],
            };
          });
        },
        {
          allowStale: true,
          background: true,
          onError: (err) =>
            req.log?.warn({ requestId: req.id, error: err.message }, "taxa autocomplete refresh failed"),
        }
      );
      res.json(out);
    } catch (err) {
      req.log?.error({ err, requestId: req.id }, "Unhandled autocomplete error");
      res.status(500).json({ error: "Erreur interne du serveur" });
    }
  }
);

// Détail d’un taxon
app.get(
  "/api/taxon/:id",
  proxyLimiter,
  async (req, res) => {
    try {
      const parsed = z
        .object({
          id: z.coerce.number().int().positive(),
          locale: z.string().default("fr"),
        })
        .safeParse({ id: req.params.id, locale: req.query.locale });
      if (!parsed.success) {
        return res.status(400).json({ error: "Paramètres invalides", issues: parsed.error.issues });
      }
      const { id, locale } = parsed.data;
      const response = await fetchInatJSON(
        `https://api.inaturalist.org/v1/taxa/${id}`,
        { locale },
        { logger: req.log, requestId: req.id, label: "taxon-detail" }
      );
      const result = Array.isArray(response.results) ? response.results[0] : undefined;
      if (!result) return res.status(404).json({ error: "Taxon non trouvé." });
      res.json(result);
    } catch (err) {
      req.log?.error({ err, requestId: req.id }, "Unhandled taxon error");
      res.status(500).json({ error: "Erreur interne du serveur" });
    }
  }
);

// Batch de taxons
app.get(
  "/api/taxa",
  proxyLimiter,
  validate(taxaBatchSchema),
  async (req, res) => {
    try {
      const { ids, locale } = req.valid;
      const taxaDetails = await getFullTaxaDetails(ids, locale, { logger: req.log, requestId: req.id });
      res.json(taxaDetails);
    } catch (err) {
      req.log?.error({ err, requestId: req.id }, "Unhandled taxa error");
      res.status(500).json({ error: "Erreur interne du serveur" });
    }
  }
);

// Species counts
app.get(
  "/api/observations/species_counts",
  proxyLimiter,
  validate(speciesCountsSchema),
  async (req, res) => {
    try {
      const {
        taxon_ids,
        include_taxa,
        exclude_taxa,
        place_id,
        nelat,
        nelng,
        swlat,
        swlng,
        d1,
        d2,
        locale,
        per_page,
        page,
      } = req.valid;

      const geo = geoParams({ place_id, nelat, nelng, swlat, swlng });
      const params = {
        locale,
        per_page,
        page,
        verifiable: true,
        quality_grade: "research",
        ...geo.p,
      };

      if (taxon_ids) params.taxon_id = Array.isArray(taxon_ids) ? taxon_ids.join(",") : taxon_ids;
      if (include_taxa) params.taxon_id = Array.isArray(include_taxa) ? include_taxa.join(",") : include_taxa;
      if (exclude_taxa) params.without_taxon_id = Array.isArray(exclude_taxa) ? exclude_taxa.join(",") : exclude_taxa;
      if (d1) params.d1 = d1;
      if (d2) params.d2 = d2;

      const data = await fetchInatJSON("https://api.inaturalist.org/v1/observations/species_counts", params, {
        logger: req.log,
        requestId: req.id,
        label: "species-counts",
      });
      res.json(data);
    } catch (err) {
      req.log?.error({ err, requestId: req.id }, "Unhandled species_counts error");
      res.status(500).json({ error: "Erreur interne du serveur" });
    }
  }
);

/* -------------------- 404 JSON propre -------------------- */
app.use((_, res) => res.status(404).json({ error: "Not Found" }));

/* -------------------- Démarrage -------------------- */
app.listen(PORT, () => {
  console.log(`Serveur Inaturamouche démarré sur le port ${PORT}`);
});
