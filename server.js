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
import PACKS from "./shared/packs.js";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { z } from "zod";
import { performance } from "node:perf_hooks";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

/* -------------------- PROXY -------------------- */
app.set("trust proxy", true);

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
  })
);

const quizLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
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

const questionCache = new Map();
const autocompleteCache = new Map();

function purgeCache(map, shouldDelete) {
  if (!map || map.size === 0) return;
  for (const [key, value] of map.entries()) {
    if (shouldDelete(value, key)) map.delete(key);
  }
}

function purgeQuestionCache(now = Date.now()) {
  purgeCache(questionCache, (entry) => !entry || entry.timestamp + QUESTION_CACHE_TTL < now);
}

function purgeAutocompleteCache(now = Date.now()) {
  purgeCache(autocompleteCache, (entry) => !entry || (entry.expires && entry.expires <= now));
}

/* -------------------- Utils -------------------- */
function buildCacheKey(obj) {
  return Object.keys(obj)
    .sort()
    .map((k) => `${k}=${Array.isArray(obj[k]) ? obj[k].join(",") : obj[k]}`)
    .join("|");
}
function setWithLimit(map, key, value) {
  if (map.size >= MAX_CACHE_ENTRIES) {
    const firstKey = map.keys().next().value;
    map.delete(firstKey);
  }
  map.set(key, value);
}
function shuffleFisherYates(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function clampNumber(n, min, max) {
  if (n == null || Number.isNaN(+n)) return null;
  const x = +n;
  return Math.max(min, Math.min(max, x));
}
function isValidISODate(s) {
  return typeof s === "string" && !Number.isNaN(Date.parse(s));
}
function effectiveCooldownN(baseN, taxonListLen) {
  const cap = Math.max(0, taxonListLen - QUIZ_CHOICES);
  return Math.max(0, Math.min(baseN, cap));
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

/* ---- fetch JSON ---- */
async function fetchJSON(url, params = {}, { timeoutMs = REQUEST_TIMEOUT_MS, retries = MAX_RETRIES } = {}) {
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
        throw new Error(`HTTP ${response.status} ${response.statusText} — ${text.slice(0, 200)}`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      if (attempt < retries) {
        attempt++;
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
}

/* -------------------- iNat helpers -------------------- */
async function getFullTaxaDetails(taxonIds, locale = "fr") {
  if (!taxonIds || taxonIds.length === 0) return [];
  try {
    const path = `https://api.inaturalist.org/v1/taxa/${taxonIds.join(",")}`;
    const localizedResponse = await fetchJSON(path, { locale });
    const localizedResults = Array.isArray(localizedResponse.results) ? localizedResponse.results : [];

    if (!locale.startsWith("en")) {
      const defaultResponse = await fetchJSON(path);
      const defaultResults = Array.isArray(defaultResponse.results) ? defaultResponse.results : [];
      const byId = new Map(defaultResults.map((t) => [t.id, t]));
      return localizedResults.map((loc) => {
        const def = byId.get(loc.id);
        if (!loc.wikipedia_url && def?.wikipedia_url) loc.wikipedia_url = def.wikipedia_url;
        if (!loc.preferred_common_name && def?.preferred_common_name) loc.preferred_common_name = def.preferred_common_name;
        return loc;
      });
    }
    return localizedResults;
  } catch (err) {
    console.error("Erreur getFullTaxaDetails:", err.message);
    return [];
  }
}
function getTaxonName(t) {
  return t?.preferred_common_name || t?.name || "Nom introuvable";
}

/* -------------------- Helpers ABCD -------------------- */
function rememberObservation(cacheEntry, obsId) {
  const id = String(obsId);
  if (cacheEntry.recentObsSet.has(id)) return;
  cacheEntry.recentObsQueue.push(id);
  cacheEntry.recentObsSet.add(id);
  while (cacheEntry.recentObsQueue.length > RECENT_OBS_MAX) {
    const old = cacheEntry.recentObsQueue.shift();
    cacheEntry.recentObsSet.delete(old);
  }
}
function pickObservationForTaxon(cacheEntry, taxonId) {
  const list = cacheEntry.byTaxon.get(String(taxonId)) || [];
  if (list.length === 0) return null;
  const pool = list.filter((o) => !cacheEntry.recentObsSet.has(String(o.id)));
  const arr = pool.length ? pool : list;
  return arr[Math.floor(Math.random() * arr.length)];
}
function lcaDepth(ancA = [], ancB = []) {
  const len = Math.min(ancA.length, ancB.length);
  let i = 0;
  while (i < len && ancA[i] === ancB[i]) i++;
  return i;
}

// Cooldown cible
function purgeTTLMap(ttlMap, now) {
  if (!ttlMap) return;
  for (const [k, exp] of ttlMap.entries()) {
    if (exp <= now) ttlMap.delete(k);
  }
}
function isBlockedByTargetCooldown(cacheEntry, taxonId, now) {
  const id = String(taxonId);
  if (COOLDOWN_TARGET_MS && cacheEntry.cooldownTarget) {
    purgeTTLMap(cacheEntry.cooldownTarget, now);
    if (cacheEntry.cooldownTarget.has(id)) return true;
  }
  if (cacheEntry.recentTargetSet.has(id)) return true;
  return false;
}
function pushTargetCooldown(cacheEntry, taxonIds, now) {
  const ids = taxonIds.map(String);
  if (COOLDOWN_TARGET_MS && cacheEntry.cooldownTarget) {
    const exp = now + COOLDOWN_TARGET_MS;
    for (const id of ids) cacheEntry.cooldownTarget.set(id, exp);
  } else {
    for (const id of ids) {
      if (!cacheEntry.recentTargetSet.has(id)) {
        cacheEntry.recentTargetTaxa.unshift(id);
        cacheEntry.recentTargetSet.add(id);
      }
    }
    const limit = effectiveCooldownN(COOLDOWN_TARGET_N, cacheEntry.taxonList.length);
    while (cacheEntry.recentTargetTaxa.length > limit) {
      const removed = cacheEntry.recentTargetTaxa.pop();
      cacheEntry.recentTargetSet.delete(removed);
    }
  }
}

// Sans-remise corrigé
function nextEligibleTaxonId(cacheEntry, now, excludeSet = new Set()) {
  const n = cacheEntry.shuffledTaxonIds.length;
  if (n === 0) return null;

  const isEligible = (tid) => {
    const key = String(tid);
    if (excludeSet.has(key)) return false;
    if (!cacheEntry.byTaxon.get(key)?.length) return false;
    if (isBlockedByTargetCooldown(cacheEntry, key, now)) return false;
    return true;
  };

  let scanned = 0;
  while (scanned < n) {
    if (cacheEntry.cursor >= n) {
      cacheEntry.shuffledTaxonIds = shuffleFisherYates(cacheEntry.shuffledTaxonIds);
      cacheEntry.cursor = 0;
    }
    const tid = cacheEntry.shuffledTaxonIds[cacheEntry.cursor];
    if (isEligible(tid)) {
      cacheEntry.cursor++; // ne consomme que si éligible
      return String(tid);
    }
    cacheEntry.shuffledTaxonIds.push(cacheEntry.shuffledTaxonIds.splice(cacheEntry.cursor, 1)[0]);
    scanned++;
  }
  return null;
}

// Fallback relax (pondéré par ancienneté) — cible
function pickRelaxedTaxon(cacheEntry, excludeSet = new Set()) {
  const all = cacheEntry.taxonList.filter(
    (t) => !excludeSet.has(String(t)) && cacheEntry.byTaxon.get(String(t))?.length
  );
  if (all.length === 0) return null;

  const weightFor = (id) => {
    const s = String(id);
    const idxT = cacheEntry.recentTargetTaxa.indexOf(s);
    if (idxT === -1) return 5;
    const lenT = cacheEntry.recentTargetTaxa.length;
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
function buildLures(cacheEntry, targetTaxonId, targetObservation, lureCount = LURE_COUNT) {
  const targetId = String(targetTaxonId);
  const seenTaxa = new Set([targetId]);

  const targetAnc = Array.isArray(targetObservation?.taxon?.ancestor_ids)
    ? targetObservation.taxon.ancestor_ids
    : [];
  const targetDepth = Math.max(targetAnc.length, 1);

  const candidates = cacheEntry.taxonList
    .filter((tid) => String(tid) !== targetId && cacheEntry.byTaxon.get(String(tid))?.length);

  const scored = candidates.map((tid) => {
    const list = cacheEntry.byTaxon.get(String(tid)) || [];
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
      const obs = pickObservationForTaxon(cacheEntry, s.tid) || s.rep;
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

      if (pack_id) {
        const selectedPack = PACKS.find((p) => p.id === pack_id);
        if (selectedPack?.api_params) Object.assign(params, selectedPack.api_params);
      } else if (taxon_ids) {
        params.taxon_id = Array.isArray(taxon_ids) ? taxon_ids.join(",") : taxon_ids;
      } else if (include_taxa || exclude_taxa) {
        if (include_taxa) params.taxon_id = Array.isArray(include_taxa) ? include_taxa.join(",") : include_taxa;
        if (exclude_taxa) params.without_taxon_id = Array.isArray(exclude_taxa) ? exclude_taxa.join(",") : exclude_taxa;
      }

      if (d1 && isValidISODate(d1)) params.d1 = d1;
      if (d2 && isValidISODate(d2)) params.d2 = d2;

      const now = Date.now();
      purgeQuestionCache(now);
      const cacheKey = buildCacheKey(params);
      let cacheEntry = questionCache.get(cacheKey);

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
        let page = 1;
        let results = [];
        let distinctTaxaSet = new Set();

        while (page <= MAX_OBS_PAGES) {
          const resp = await fetchJSON("https://api.inaturalist.org/v1/observations", { ...params, page });
          const batch = Array.isArray(resp.results) ? resp.results : [];
          results = results.concat(batch);
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
          byTaxon,
          taxonList,
          shuffledTaxonIds: shuffleFisherYates(taxonList),
          cursor: 0,

          recentTargetTaxa: [],
          recentTargetSet: new Set(),
          cooldownTarget: COOLDOWN_TARGET_MS ? new Map() : null,

          recentObsQueue: [],
          recentObsSet: new Set(),
        };
        setWithLimit(questionCache, cacheKey, cacheEntry);

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
      const excludeTaxaForTarget = new Set();
      let targetTaxonId = nextEligibleTaxonId(cacheEntry, now, excludeTaxaForTarget);

      let selectionMode = "normal";
      if (!targetTaxonId) {
        targetTaxonId = pickRelaxedTaxon(cacheEntry, excludeTaxaForTarget);
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

      const targetObservation = pickObservationForTaxon(cacheEntry, targetTaxonId);
      if (!targetObservation) {
        marks.pickedTarget = performance.now();
        marks.builtLures = marks.pickedTarget;
        marks.taxaFetched = marks.builtLures;
        marks.labelsMade = marks.taxaFetched;
        marks.end = performance.now();
        setTimingHeaders(res, marks, { pagesFetched, poolObs, poolTaxa });
        return res.status(503).json({ error: "Aucune observation exploitable trouvée pour le taxon cible." });
      }
      rememberObservation(cacheEntry, targetObservation.id);
      marks.pickedTarget = performance.now();

      // LEURRES
      const { lures, buckets } = buildLures(cacheEntry, targetTaxonId, targetObservation, LURE_COUNT);
      if (!lures || lures.length < LURE_COUNT) {
        marks.builtLures = performance.now();
        marks.taxaFetched = marks.builtLures;
        marks.labelsMade = marks.taxaFetched;
        marks.end = performance.now();
        setTimingHeaders(res, marks, { pagesFetched, poolObs, poolTaxa });
        return res.status(404).json({ error: "Pas assez d'espèces différentes pour composer les choix." });
      }
      marks.builtLures = performance.now();

      // DÉTAILS localisés — OPTI : on ne fetch QUE pour la CIBLE
      const [correctDetails] = await getFullTaxaDetails([String(targetTaxonId)], locale);
      const correct = correctDetails || (targetObservation?.taxon ?? null);
      if (!correct) {
        marks.taxaFetched = performance.now();
        marks.labelsMade = marks.taxaFetched;
        marks.end = performance.now();
        setTimingHeaders(res, marks, { pagesFetched, poolObs, poolTaxa });
        return res.status(502).json({ error: `Impossible de récupérer les détails du taxon ${targetTaxonId}` });
      }

      // Construire une map “détails” compatible avec makeChoiceLabels
      const details = new Map();
      details.set(String(targetTaxonId), correct); // cible = détails riches
      for (const l of lures) {
        details.set(String(l.taxonId), l.obs?.taxon || {}); // leurres = obs.taxon déjà présent
      }
      marks.taxaFetched = performance.now();

      // CHOIX "RICHE"
      const choiceIdsInOrder = [String(targetTaxonId), ...lures.map((l) => String(l.taxonId))];
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
      const image_urls = (Array.isArray(targetObservation.photos) ? targetObservation.photos : [])
        .map((p) => (p?.url ? p.url.replace("square", "large") : null))
        .filter(Boolean);

      // Cooldown cible
      pushTargetCooldown(cacheEntry, [String(targetTaxonId)], now);

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
        bonne_reponse: {
          id: correct.id,
          name: correct.name,
          common_name: getTaxonName(correct),
          ancestors: Array.isArray(correct.ancestors) ? correct.ancestors : [],
          wikipedia_url: correct.wikipedia_url,
        },

        // --- Choix "riches"
        choices: shuffledChoices, // [{ taxon_id, label }]
        correct_choice_index,
        correct_label,

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
      console.error("Unhandled route error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Erreur interne du serveur" });
    }
  }
);

// --- AUTOCOMPLETE PLACES ---
app.get("/api/places", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const per_page = Math.min(25, Number(req.query.per_page || 15));
    if (q.length < 2) return res.json([]);

    const cacheKey = buildCacheKey({ places: q, per_page });
    const now = Date.now();
    purgeAutocompleteCache(now);
    const cached = autocompleteCache.get(cacheKey);
    if (cached && cached.expires > now) return res.json(cached.data);

    const data = await fetchJSON("https://api.inaturalist.org/v1/places/autocomplete", { q, per_page });
    const out = (data.results || []).map((p) => ({
      id: p.id,
      name: p.display_name || p.name,
      type: p.place_type_name,
      admin_level: p.admin_level,
      area_km2: p.bounding_box_area,
    }));
    setWithLimit(autocompleteCache, cacheKey, { data: out, expires: now + AUTOCOMPLETE_CACHE_TTL });
    res.json(out);
  } catch (e) {
    res.status(500).json([]);
  }
});

app.get("/api/places/by-id", async (req, res) => {
  try {
    const ids = String(req.query.ids || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .join(",");
    if (!ids) return res.json([]);
    const data = await fetchJSON(`https://api.inaturalist.org/v1/places/${ids}`);
    const arr = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
    const out = arr.map(p => ({
      id: p.id,
      name: p.display_name || p.name,
      type: p.place_type_name,
      admin_level: p.admin_level,
      area_km2: p.bounding_box_area,
    }));
    res.json(out);
  } catch (e) {
    res.status(500).json([]);
  }
});

// Autocomplete taxons
app.get(
  "/api/taxa/autocomplete",
  validate(autocompleteSchema),
  async (req, res) => {
    try {
      const { q, rank, locale = "fr" } = req.valid;
      const now = Date.now();
      purgeAutocompleteCache(now);
      const cacheKey = buildCacheKey({ q: String(q).trim(), rank, locale });

      const cached = autocompleteCache.get(cacheKey);
      if (cached && cached.expires > now) {
        return res.json(cached.data);
      }

      const params = { q: String(q).trim(), is_active: true, per_page: 10, locale };
      if (rank) params.rank = rank;

      const response = await fetchJSON("https://api.inaturalist.org/v1/taxa/autocomplete", params);
      const initial = Array.isArray(response.results) ? response.results : [];
      if (initial.length === 0) {
        setWithLimit(autocompleteCache, cacheKey, { data: [], expires: now + AUTOCOMPLETE_CACHE_TTL });
        return res.json([]);
      }

      const taxonIds = initial.map((t) => t.id);
      const taxaDetails = await getFullTaxaDetails(taxonIds, locale);
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

      setWithLimit(autocompleteCache, cacheKey, { data: out, expires: now + AUTOCOMPLETE_CACHE_TTL });
      res.json(out);
    } catch (err) {
      console.error("Unhandled autocomplete error:", err);
      res.status(500).json({ error: "Erreur interne du serveur" });
    }
  }
);

// Détail d’un taxon
app.get(
  "/api/taxon/:id",
  async (req, res) => {
    try {
      const { id } = req.params;
      const { locale = "fr" } = req.query;
      const response = await fetchJSON(`https://api.inaturalist.org/v1/taxa/${id}`, { locale });
      const result = Array.isArray(response.results) ? response.results[0] : undefined;
      if (!result) return res.status(404).json({ error: "Taxon non trouvé." });
      res.json(result);
    } catch (err) {
      console.error("Unhandled taxon error:", err);
      res.status(500).json({ error: "Erreur interne du serveur" });
    }
  }
);

// Batch de taxons
app.get(
  "/api/taxa",
  async (req, res) => {
    try {
      const { ids, locale = "fr" } = req.query;
      if (!ids) return res.status(400).json({ error: "Le paramètre 'ids' est requis." });

      const taxonIds = String(ids)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const taxaDetails = await getFullTaxaDetails(taxonIds, locale);
      res.json(taxaDetails);
    } catch (err) {
      console.error("Unhandled taxa error:", err);
      res.status(500).json({ error: "Erreur interne du serveur" });
    }
  }
);

// Species counts
app.get(
  "/api/observations/species_counts",
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

      const data = await fetchJSON("https://api.inaturalist.org/v1/observations/species_counts", params);
      res.json(data);
    } catch (err) {
      console.error("Unhandled species_counts error:", err);
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
