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
import { findPackById, listPublicPacks } from "./server/packs/index.js";
import {
  buildCacheKey,
  effectiveCooldownN,
  lcaDepth,
  shuffleFisherYates,
} from "./lib/quiz-utils.js";
import { SimpleLRUCache } from "./lib/simple-lru.js";
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
        "connect-src": ["'self'", "https://api.inaturalist.org"],
        "img-src": [
          "'self'",
          "data:",
          "https:",
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
const AUTOCOMPLETE_CACHE_TTL = 1000 * 60 * 10; // 10 min
const MAX_CACHE_ENTRIES = 50;
const QUIZ_CHOICES = 4;
const LURE_COUNT = QUIZ_CHOICES - 1;
const TAXON_DETAILS_CACHE_TTL = 1000 * 60 * 60 * 24; // 24h
const TAXON_DETAILS_CACHE_MAX = 2000;

// Cooldown CIBLE (en nombre de questions)
const COOLDOWN_TARGET_N = 60;
// Variante TTL (ms) si souhaitée (null = désactivé)
const COOLDOWN_TARGET_MS = null;

// Anti-répétition par OBSERVATION (cible)
const RECENT_OBS_MAX = 200;

// Extension du pool
const MAX_OBS_PAGES = 1;
const DISTINCT_TAXA_TARGET = 30;

// Seuils proximité des leurres (profondeur LCA normalisée par profondeur cible)
const LURE_NEAR_THRESHOLD = 0.85;
const LURE_MID_THRESHOLD = 0.65;

const questionCache = new SimpleLRUCache({ max: MAX_CACHE_ENTRIES, ttl: QUESTION_CACHE_TTL });
const autocompleteCache = new SimpleLRUCache({ max: MAX_CACHE_ENTRIES, ttl: AUTOCOMPLETE_CACHE_TTL });
const SELECTION_STATE_TTL = 1000 * 60 * 10;
const MAX_SELECTION_STATES = 200;
const selectionStateCache = new SimpleLRUCache({ max: MAX_SELECTION_STATES, ttl: SELECTION_STATE_TTL });
const taxonDetailsCache = new SimpleLRUCache({
  max: TAXON_DETAILS_CACHE_MAX,
  ttl: TAXON_DETAILS_CACHE_TTL,
});

function createSelectionState(pool) {
  return {
    recentTargetTaxa: [],
    recentTargetSet: new Set(),
    cooldownTarget: COOLDOWN_TARGET_MS ? new Map() : null,
    recentObsQueue: [],
    recentObsSet: new Set(),
    shuffledTaxonIds: shuffleFisherYates(pool.taxonList),
    cursor: 0,
    version: pool.version,
  };
}

function getSelectionStateForClient(cacheKey, clientId, pool, now) {
  const key = `${cacheKey}|${clientId || "anon"}`;
  let state = selectionStateCache.get(key);
  if (
    !state ||
    !Array.isArray(state.shuffledTaxonIds) ||
    state.version !== pool.version ||
    state.expires <= now
  ) {
    state = createSelectionState(pool);
  } else if (state.shuffledTaxonIds.length === 0) {
    state.shuffledTaxonIds = shuffleFisherYates(pool.taxonList);
    state.cursor = 0;
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

  const taxon = obs.taxon || {};
  return {
    id: obs.id,
    uri: obs.uri,
    photos,
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
        throw new Error(errorMessage);
      }
      logger?.debug({ ...requestMeta, durationMs: Date.now() - startedAt }, "iNat fetch success");
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
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

/* -------------------- iNat helpers -------------------- */
async function getFullTaxaDetails(taxonIds, locale = "fr", { logger, requestId } = {}) {
  if (!taxonIds || taxonIds.length === 0) return [];
  const requestedIds = taxonIds.map((id) => String(id));
  const uniqueIds = Array.from(new Set(requestedIds));
  const cachedResults = [];

  try {
    taxonDetailsCache.prune();
    const missingIds = [];

    for (const id of uniqueIds) {
      const cached = taxonDetailsCache.get(`${id}:${locale}`);
      if (cached) {
        cachedResults.push(cached);
      } else {
        missingIds.push(id);
      }
    }

    let fetchedResults = [];
    if (missingIds.length > 0) {
      const path = `https://api.inaturalist.org/v1/taxa/${missingIds.join(",")}`;
      const localizedResponse = await fetchJSON(path, { locale }, { logger, requestId, label: "taxa-localized" });
      const localizedResults = Array.isArray(localizedResponse.results) ? localizedResponse.results : [];

      let defaultResults = [];
      if (!locale.startsWith("en")) {
        const defaultResponse = await fetchJSON(path, {}, { logger, requestId, label: "taxa-default" });
        defaultResults = Array.isArray(defaultResponse.results) ? defaultResponse.results : [];
      }

      const defaultById = new Map(defaultResults.map((t) => [String(t.id), t]));
      const localizedById = new Map(localizedResults.map((t) => [String(t.id), t]));

      fetchedResults = missingIds
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

      for (const taxon of fetchedResults) {
        if (taxon?.id != null) {
          const cacheKey = `${String(taxon.id)}:${locale}`;
          taxonDetailsCache.set(cacheKey, taxon);
        }
      }
    }

    const byId = new Map();
    for (const t of [...cachedResults, ...fetchedResults]) {
      if (t?.id == null) continue;
      byId.set(String(t.id), t);
    }

    const ordered = requestedIds.map((id) => byId.get(id)).filter(Boolean);
    if (ordered.length > 0) return ordered;
    return Array.from(byId.values());
  } catch (err) {
    if (logger) {
      logger.error({ requestId, error: err.message }, "Erreur getFullTaxaDetails");
    } else {
      console.error("Erreur getFullTaxaDetails:", err.message);
    }
    const fallbackMap = new Map(cachedResults.map((t) => [String(t.id), t]));
    const orderedFallback = requestedIds.map((id) => fallbackMap.get(id)).filter(Boolean);
    return orderedFallback;
  }
}
function getTaxonName(t) {
  return t?.preferred_common_name || t?.name || "Nom introuvable";
}

/* -------------------- Helpers ABCD -------------------- */
function rememberObservation(selectionState, obsId) {
  const id = String(obsId);
  if (selectionState.recentObsSet.has(id)) return;
  selectionState.recentObsQueue.push(id);
  selectionState.recentObsSet.add(id);
  while (selectionState.recentObsQueue.length > RECENT_OBS_MAX) {
    const old = selectionState.recentObsQueue.shift();
    selectionState.recentObsSet.delete(old);
  }
}
function pickObservationForTaxon(pool, selectionState, taxonId) {
  const list = pool.byTaxon.get(String(taxonId)) || [];
  if (list.length === 0) return null;
  const filtered = list.filter((o) => !selectionState.recentObsSet.has(String(o.id)));
  const arr = filtered.length ? filtered : list;
  return arr[Math.floor(Math.random() * arr.length)];
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
 * @returns {string|null} Eligible taxon id or null if none available.
 */
function nextEligibleTaxonId(pool, selectionState, now, excludeSet = new Set()) {
  if (!Array.isArray(selectionState.shuffledTaxonIds) || selectionState.shuffledTaxonIds.length === 0) {
    selectionState.shuffledTaxonIds = shuffleFisherYates(pool.taxonList);
    selectionState.cursor = 0;
  }
  const n = selectionState.shuffledTaxonIds.length;
  if (n === 0) return null;

  const isEligible = (tid) => {
    const key = String(tid);
    if (excludeSet.has(key)) return false;
    if (!pool.byTaxon.get(key)?.length) return false;
    if (isBlockedByTargetCooldown(selectionState, key, now)) return false;
    return true;
  };

  let scanned = 0;
  while (scanned < n) {
    if (selectionState.cursor >= n) {
      selectionState.shuffledTaxonIds = shuffleFisherYates(selectionState.shuffledTaxonIds);
      selectionState.cursor = 0;
    }
    const tid = selectionState.shuffledTaxonIds[selectionState.cursor];
    if (isEligible(tid)) {
      selectionState.cursor++; // ne consomme que si éligible
      return String(tid);
    }
    selectionState.shuffledTaxonIds.push(selectionState.shuffledTaxonIds.splice(selectionState.cursor, 1)[0]);
    scanned++;
  }
  return null;
}

// Fallback relax (pondéré par ancienneté) — cible
function pickRelaxedTaxon(pool, selectionState, excludeSet = new Set()) {
  const all = pool.taxonList.filter(
    (t) => !excludeSet.has(String(t)) && pool.byTaxon.get(String(t))?.length
  );
  if (all.length === 0) return null;

  const weightFor = (id) => {
    const s = String(id);
    const idxT = selectionState.recentTargetTaxa.indexOf(s);
    if (idxT === -1) return 5;
    const lenT = selectionState.recentTargetTaxa.length;
    return Math.max(1, lenT - idxT);
  };

  const weights = all.map(weightFor);
  const total = weights.reduce((a, b) => a + b, 0) || all.length;
  let r = Math.random() * total;
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
 * @returns {{ lures: Array<{ taxonId: string, obs: any }>, buckets: { near: number, mid: number, far: number } }}
 */
function buildLures(pool, selectionState, targetTaxonId, targetObservation, lureCount = LURE_COUNT) {
  const targetId = String(targetTaxonId);
  const seenTaxa = new Set([targetId]);

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
    arr.sort((a, b) => (b.depth + Math.random() * 0.01) - (a.depth + Math.random() * 0.01));
  jitterSort(near); jitterSort(mid); jitterSort(far);

  const out = [];
  const pickFromArr = (arr) => {
    for (const s of arr) {
      if (out.length >= lureCount) return;
      if (seenTaxa.has(s.tid)) continue;
      const obs = pickObservationForTaxon(pool, selectionState, s.tid) || s.rep;
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
    const rest = shuffleFisherYates(scored);
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
  locale: z.string().default("fr"),
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
  ids: csvIds(50),
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
function setTimingHeaders(res, marks, extra = {}) {
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
  res.set("X-Timing", JSON.stringify(timing));
  const serverTiming =
    `fetchObs;dur=${timing.fetchObsMs}, ` +
    `buildIndex;dur=${timing.buildIndexMs}, ` +
    `pickTarget;dur=${timing.pickTargetMs}, ` +
    `buildLures;dur=${timing.buildLuresMs}, ` +
    `taxa;dur=${timing.taxaDetailsMs}, ` +
    `labels;dur=${timing.labelsMs}, ` +
    `total;dur=${timing.totalMs}`;
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
    const marks = {};
    try {
      marks.start = performance.now();

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
        locale = "fr",
      } = req.valid;

      const geo = geoParams({ place_id, nelat, nelng, swlat, swlng });
      const params = {
        quality_grade: "research",
        photos: true,
        rank: "species",
        per_page: 80,
        locale,
        ...geo.p,
      };
      const monthDayFilter = buildMonthDayFilter(d1, d2);

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

      if (monthDayFilter?.months?.length) {
        params.month = monthDayFilter.months.join(",");
      } else {
        if (d1 && isValidISODate(d1)) params.d1 = d1;
        if (d2 && isValidISODate(d2)) params.d2 = d2;
      }
      const cacheKeyParams = { ...params };
      if (monthDayFilter) {
        cacheKeyParams.d1 = d1 || "";
        cacheKeyParams.d2 = d2 || "";
      }

      const now = Date.now();
      questionCache.prune();
      selectionStateCache.prune();
      const cacheKey = buildCacheKey(cacheKeyParams);
      let cacheEntry = questionCache.get(cacheKey);
      if (cacheEntry && !cacheEntry.version) {
        cacheEntry.version = cacheEntry.timestamp || now;
      }

      let pagesFetched = 0;
      let poolObs = 0;
      let poolTaxa = 0;

      // (Re)chargement du pool
      if (
        !cacheEntry ||
        cacheEntry.timestamp + QUESTION_CACHE_TTL < now ||
        !cacheEntry.byTaxon ||
        !Array.isArray(cacheEntry.taxonList) ||
        cacheEntry.taxonList.length < QUIZ_CHOICES
      ) {
        let startPage = 1;
        try {
          const probeParams = { ...params, per_page: 1, page: 1 };
          const probe = await fetchJSON(
            "https://api.inaturalist.org/v1/observations",
            probeParams,
            { logger: req.log, requestId: req.id, label: "obs-total-probe" }
          );
          const totalResults = Number(probe?.total_results) || 0;
          if (totalResults > 0) {
            const perPage = Number(params.per_page) || 80;
            const totalPages = Math.max(1, Math.ceil(totalResults / perPage));
            const capped = Math.max(1, Math.min(totalPages, 10));
            startPage = Math.floor(Math.random() * capped) + 1;
          }
        } catch (prefetchErr) {
          req.log?.warn({ requestId: req.id, error: prefetchErr.message }, "Observation total prefetch failed");
          startPage = 1;
        }

        let page = startPage;
        let results = [];
        let distinctTaxaSet = new Set();

        while (pagesFetched < MAX_OBS_PAGES) {
          const resp = await fetchJSON("https://api.inaturalist.org/v1/observations", { ...params, page }, { logger: req.log, requestId: req.id });
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
          marks.fetchedObs = performance.now();
          marks.builtIndex = marks.fetchedObs;
          marks.pickedTarget = marks.builtIndex;
          marks.builtLures = marks.pickedTarget;
          marks.taxaFetched = marks.builtLures;
          marks.labelsMade = marks.taxaFetched;
          marks.end = performance.now();
          setTimingHeaders(res, marks, { pagesFetched: 0, poolObs: 0, poolTaxa: 0 });
          return res
            .status(404)
            .json({ error: "Aucune observation trouvée avec vos critères. Élargissez la zone ou la période." });
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

        const taxonList = Array.from(byTaxon.keys());
        if (taxonList.length < QUIZ_CHOICES) {
          marks.fetchedObs = performance.now();
          marks.builtIndex = marks.fetchedObs;
          marks.pickedTarget = marks.builtIndex;
          marks.builtLures = marks.pickedTarget;
          marks.taxaFetched = marks.builtLures;
          marks.labelsMade = marks.taxaFetched;
          marks.end = performance.now();
          setTimingHeaders(res, marks, { pagesFetched, poolObs: results.length, poolTaxa: taxonList.length });
          return res
            .status(404)
            .json({ error: "Pas assez d'espèces différentes pour créer un quiz avec ces critères." });
        }

        cacheEntry = {
          timestamp: now,
          version: now,
          byTaxon,
          taxonList,
        };
        questionCache.set(cacheKey, cacheEntry);

        poolObs = results.length;
        poolTaxa = taxonList.length;
        marks.fetchedObs = performance.now();
        marks.builtIndex = marks.fetchedObs; // on a construit les index pendant la boucle
      } else {
        // Pool déjà en cache
        pagesFetched = 0;
        poolObs = Array.from(cacheEntry.byTaxon.values()).reduce((n, arr) => n + arr.length, 0);
        poolTaxa = cacheEntry.taxonList.length;
        marks.fetchedObs = performance.now();
        marks.builtIndex = marks.fetchedObs;
      }

      // CIBLE
      const clientIp = getClientIp(req);
      const { state: selectionState } = getSelectionStateForClient(cacheKey, clientIp, cacheEntry, now);
      const excludeTaxaForTarget = new Set();
      let targetTaxonId = nextEligibleTaxonId(cacheEntry, selectionState, now, excludeTaxaForTarget);

      let selectionMode = "normal";
      if (!targetTaxonId) {
        targetTaxonId = pickRelaxedTaxon(cacheEntry, selectionState, excludeTaxaForTarget);
        selectionMode = "fallback_relax";
        req.log?.info(
          { cacheKey, mode: selectionMode, pool: cacheEntry.taxonList.length, recentT: cacheEntry.recentTargetTaxa.length },
          "Target fallback relax engaged"
        );
      }
      if (!targetTaxonId) {
        marks.pickedTarget = performance.now();
        marks.builtLures = marks.pickedTarget;
        marks.taxaFetched = marks.builtLures;
        marks.labelsMade = marks.taxaFetched;
        marks.end = performance.now();
        setTimingHeaders(res, marks, { pagesFetched, poolObs, poolTaxa });
        return res.status(503).json({ error: "Pool d'observations indisponible, réessayez." });
      }
      res.set("X-Selection-Geo", geo.mode);

      const targetObservation = pickObservationForTaxon(cacheEntry, selectionState, targetTaxonId);
      if (!targetObservation) {
        marks.pickedTarget = performance.now();
        marks.builtLures = marks.pickedTarget;
        marks.taxaFetched = marks.builtLures;
        marks.labelsMade = marks.taxaFetched;
        marks.end = performance.now();
        setTimingHeaders(res, marks, { pagesFetched, poolObs, poolTaxa });
        return res.status(503).json({ error: "Aucune observation exploitable trouvée pour le taxon cible." });
      }
      rememberObservation(selectionState, targetObservation.id);
      marks.pickedTarget = performance.now();

      // LEURRES
      const { lures, buckets } = buildLures(cacheEntry, selectionState, targetTaxonId, targetObservation, LURE_COUNT);
      if (!lures || lures.length < LURE_COUNT) {
        marks.builtLures = performance.now();
        marks.taxaFetched = marks.builtLures;
        marks.labelsMade = marks.taxaFetched;
        marks.end = performance.now();
        setTimingHeaders(res, marks, { pagesFetched, poolObs, poolTaxa });
        return res.status(404).json({ error: "Pas assez d'espèces différentes pour composer les choix." });
      }
      marks.builtLures = performance.now();

      const choiceIdsInOrder = [String(targetTaxonId), ...lures.map((l) => String(l.taxonId))];

      const fallbackDetails = new Map();
      fallbackDetails.set(String(targetTaxonId), targetObservation?.taxon || {});
      for (const lure of lures) {
        fallbackDetails.set(String(lure.taxonId), lure.obs?.taxon || {});
      }

      const choiceTaxaDetails = await getFullTaxaDetails(choiceIdsInOrder, locale, {
        logger: req.log,
        requestId: req.id,
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
        marks.taxaFetched = performance.now();
        marks.labelsMade = marks.taxaFetched;
        marks.end = performance.now();
        setTimingHeaders(res, marks, { pagesFetched, poolObs, poolTaxa });
        return res.status(502).json({ error: `Impossible de récupérer les détails du taxon ${targetTaxonId}` });
      }

      // Construire une map “détails” compatible avec makeChoiceLabels
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

      // CHOIX "RICHE"
      const labelsInOrder = makeChoiceLabels(details, choiceIdsInOrder);
      const choiceObjects = choiceIdsInOrder.map((id, idx) => ({ taxon_id: id, label: labelsInOrder[idx] }));
      const shuffledChoices = shuffleFisherYates(choiceObjects);
      const correct_choice_index = shuffledChoices.findIndex((c) => c.taxon_id === String(targetTaxonId));
      const correct_label = shuffledChoices[correct_choice_index]?.label || getTaxonName(correct);

      // MODE FACILE
      const facilePairs = choiceIdsInOrder.map((id) => ({
        taxon_id: id,
        label: getTaxonName(details.get(String(id))),
      }));
      const facileShuffled = shuffleFisherYates(facilePairs);
      const choix_mode_facile = facileShuffled.map((p) => p.label);
      const choix_mode_facile_ids = facileShuffled.map((p) => p.taxon_id);
      const choix_mode_facile_correct_index = choix_mode_facile_ids.findIndex(
        (id) => id === String(targetTaxonId)
      );
      marks.labelsMade = performance.now();

      // Images
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

      // Cooldown cible
      pushTargetCooldown(cacheEntry, selectionState, [String(targetTaxonId)], now);

      // Entêtes debug/observabilité
      res.set("X-Cache-Key", cacheKey);
      res.set("X-Lures-Relaxed", "0");
      res.set("X-Lure-Buckets", `${buckets.near}|${buckets.mid}|${buckets.far}`);
      res.set("X-Pool-Pages", String(pagesFetched));
      res.set("X-Pool-Obs", String(poolObs));
      res.set("X-Pool-Taxa", String(poolTaxa));

      marks.end = performance.now();
      const timing = setTimingHeaders(res, marks, { pagesFetched, poolObs, poolTaxa });

      // Log structuré des timings
      req.log?.info(
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

      // Réponse
      res.json({
        image_urls,
        image_meta,
        bonne_reponse: {
          id: correct.id,
          name: correct.name,
          preferred_common_name: correct.preferred_common_name || correct.common_name || null,
          common_name: getTaxonName(correct),
          ancestors: Array.isArray(correct.ancestors) ? correct.ancestors : [],
          wikipedia_url: correct.wikipedia_url,
        },

        // --- Choix "riches"
        choices: shuffledChoices, // [{ taxon_id, label }]
        correct_choice_index,
        correct_label,
        choice_taxa_details: choiceTaxaInfo,

        // --- MODE FACILE ---
        choix_mode_facile,                   // [label]
        choix_mode_facile_ids,              // [taxon_id] aligné aux labels
        choix_mode_facile_correct_index,    // index du bon choix

        inaturalist_url: targetObservation.uri,
      });
    } catch (err) {
      try {
        // tenter d'envoyer des timings même en cas d'erreur tardive
        if (!res.headersSent) {
          const now = performance.now();
          const safe = (k, def) => (typeof marks[k] === "number" ? marks[k] : def);
          marks.fetchedObs = safe("fetchedObs", now);
          marks.builtIndex = safe("builtIndex", marks.fetchedObs);
          marks.pickedTarget = safe("pickedTarget", marks.builtIndex);
          marks.builtLures = safe("builtLures", marks.pickedTarget);
          marks.taxaFetched = safe("taxaFetched", marks.builtLures);
          marks.labelsMade = safe("labelsMade", marks.taxaFetched);
          marks.end = now;
          setTimingHeaders(res, marks);
        }
      } catch (_) {}
      req.log?.error({ err, requestId: req.id }, "Unhandled quiz route error");
      if (!res.headersSent) res.status(500).json({ error: "Erreur interne du serveur" });
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
      const now = Date.now();
      autocompleteCache.prune();
      const cached = autocompleteCache.get(cacheKey);
      if (cached && cached.expires > now) return res.json(cached.data);

      const data = await fetchJSON(
        "https://api.inaturalist.org/v1/places/autocomplete",
        { q, per_page },
        { logger: req.log, requestId: req.id, label: "places-autocomplete" }
      );
      const out = (data.results || []).map((p) => ({
        id: p.id,
        name: p.display_name || p.name,
        type: p.place_type_name,
        admin_level: p.admin_level,
        area_km2: p.bounding_box_area,
      }));
      autocompleteCache.set(cacheKey, { data: out });
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
      const data = await fetchJSON(`https://api.inaturalist.org/v1/places/${idsParam}`, {}, {
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
      const now = Date.now();
      autocompleteCache.prune();
      const cacheKey = buildCacheKey({ q: String(q).trim(), rank, locale });

      const cached = autocompleteCache.get(cacheKey);
      if (cached && cached.expires > now) {
        return res.json(cached.data);
      }

      const params = { q: String(q).trim(), is_active: true, per_page: 10, locale };
      if (rank) params.rank = rank;

      const response = await fetchJSON("https://api.inaturalist.org/v1/taxa/autocomplete", params, {
        logger: req.log,
        requestId: req.id,
        label: "taxa-autocomplete",
      });
      const initial = Array.isArray(response.results) ? response.results : [];
      if (initial.length === 0) {
        autocompleteCache.set(cacheKey, { data: [] });
        return res.json([]);
      }

      const taxonIds = initial.map((t) => t.id);
      const taxaDetails = await getFullTaxaDetails(taxonIds, locale, { logger: req.log, requestId: req.id });
      const byId = new Map(taxaDetails.map((t) => [t.id, t]));

      const out = initial.map((t) => {
        const d = byId.get(t.id);
        return {
          id: t.id,
          name: t.preferred_common_name ? `${t.preferred_common_name} (${t.name})` : t.name,
          rank: t.rank,
          ancestor_ids: Array.isArray(d?.ancestors) ? d.ancestors.map((a) => a.id) : [],
        };
      });

      autocompleteCache.set(cacheKey, { data: out });
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
      const response = await fetchJSON(
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

      const data = await fetchJSON("https://api.inaturalist.org/v1/observations/species_counts", params, {
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
