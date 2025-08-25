// server.js — Inaturamouche (durci + observabilité + validation)
// Basé sur ta version existante avec logique quiz/caches/anti-répétitions, enrichi :
// - Helmet avec CSP + Referrer-Policy
// - Pino logs HTTP
// - Rate-limit global + spécifique quiz (~1 req/s)
// - Validation Zod (quiz, autocomplete, species_counts)
// - Endpoint /api/observations/species_counts
// - Healthcheck /healthz (warm-up Render)

import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import PACKS from "./shared/packs.js";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { z } from "zod";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

/* -------------------- CORS -------------------- */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://inaturamouche.onrender.com",
  "https://inaturaquizz.onrender.app",
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

/* -------------------- Middleware -------------------- */
app.use(express.json({ limit: "1mb" }));
app.use(compression());
app.use(
  pinoHttp({
    autoLogging: true,
    transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
    redact: ["req.headers.authorization"],
  })
);

app.use(cors(corsOptions));
app.use((req, res, next) => {
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
          "https://inaturalist-open-data.s3.amazonaws.com"
        ],
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'", "https:", "data:"],
        "script-src": ["'self'"]
      }
    }
  })
);

// Cache-Control
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
const MAX_RETRIES = 2; // total 3 tentatives
const QUESTION_CACHE_TTL = 1000 * 60 * 5; // 5 min
const AUTOCOMPLETE_CACHE_TTL = 1000 * 60 * 10; // 10 min
const MAX_CACHE_ENTRIES = 50;
const QUIZ_CHOICES = 4;
const LURE_COUNT = QUIZ_CHOICES - 1;

// Anti-répétitions : ACTIVER L’UN DES DEUX
const COOL_DOWN_N = 60;        // (D) ne pas revoir une espèce dans les 60 prochaines questions
const COOL_DOWN_MS = null;     // ex. 7 * 24 * 60 * 60 * 1000 ; laisser null si non utilisé

const questionCache = new Map();
/*
  key = buildCacheKey(params iNat)
  value = {
    timestamp: number,
    // ---- ABCD ----
    // C: tirage sans remise
    uniqueTaxaIds: string[],
    shuffledTaxa: string[],
    cursor: number,
    // B: liste d'observations par taxon
    obsByTaxon: Map<taxonId, Observation[]>,
    taxaMeta: Map<taxonId, { ancestor_ids: number[], taxon: object }>,
    // D: cooldown dynamique par cache
    cooldownN: number,
    // A + D: anti-répétitions
    recentTaxa: string[],
    recentSet: Set<string>,
    cooldown: Map<string, number> | null, // si COOL_DOWN_MS
    // A: anti-répétition par observation
    recentObsQueue: number[], // observation ids
    recentObsSet: Set<number>,
  }
*/

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

/* ---- fetch JSON (timeout + retry 429/5xx + abort) ---- */
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
          // iNaturalist apprécie un User-Agent explicite
          "User-Agent": "Inaturamouche/1.0 (+contact: you@example.com)",
        }
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

    // Fallback si champs manquants
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

/* -------------------- Healthz -------------------- */
app.get("/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));

/* -------------------- Validation schemas -------------------- */
const quizSchema = z.object({
  pack_id: z.string().optional(),
  taxon_ids: z.string().optional(),
  include_taxa: z.string().optional(),
  exclude_taxa: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().optional(),
  d1: z.string().optional(),
  d2: z.string().optional(),
  locale: z.string().default("fr"),
});
const autocompleteSchema = z.object({
  q: z.string(),
  rank: z.string().optional(),
  locale: z.string().default("fr"),
});
const speciesCountsSchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().optional(),
  d1: z.string().optional(),
  d2: z.string().optional(),
});

/* -------------------- Valideur -------------------- */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.valid = schema.parse(
        req.method === "GET" ? Object.assign({}, req.query) : Object.assign({}, req.body)
      );
      next();
    } catch (e) {
      return res.status(400).json({ error: "Invalid request", details: e.errors || String(e) });
    }
  };
}

/* -------------------- Async wrapper -------------------- */
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* -------------------- Rate limits -------------------- */
const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(globalLimiter);
const quizLimiter = rateLimit({ windowMs: 1000, max: 2 });

/* -------------------- Autocomplete cache -------------------- */
const autocompleteCache = new Map();

/* -------------------- Quiz question -------------------- */
app.get(
  "/api/quiz-question",
  quizLimiter,
  validate(quizSchema),
  asyncRoute(async (req, res) => {
    const {
      pack_id,
      taxon_ids,
      include_taxa,
      exclude_taxa,
      lat,
      lng,
      radius,
      d1,
      d2,
      locale = "fr",
    } = req.valid;

    const params = {
      quality_grade: "research",
      photos: true,
      rank: "species",
      per_page: 200,
      locale,
    };

    // Packs & filtres
    if (pack_id) {
      const selectedPack = PACKS.find((p) => p.id === pack_id);
      if (!selectedPack) return res.status(400).json({ error: "pack_id inconnu" });
      if (selectedPack?.api_params) Object.assign(params, selectedPack.api_params);
    } else if (taxon_ids) {
      params.taxon_id = Array.isArray(taxon_ids) ? taxon_ids.join(",") : taxon_ids;
    } else if (include_taxa || exclude_taxa) {
      if (include_taxa) params.taxon_id = Array.isArray(include_taxa) ? include_taxa.join(",") : include_taxa;
      if (exclude_taxa) params.without_taxon_id = Array.isArray(exclude_taxa) ? exclude_taxa.join(",") : exclude_taxa;
    }

    const latNum = clampNumber(lat, -90, 90);
    const lngNum = clampNumber(lng, -180, 180);
    const radiusNum = clampNumber(radius, 0, 200);
    if (latNum !== null && lngNum !== null && radiusNum !== null) {
      Object.assign(params, { lat: latNum, lng: lngNum, radius: radiusNum });
    }
    if (d1 && isValidISODate(d1)) params.d1 = d1;
    if (d2 && isValidISODate(d2)) params.d2 = d2;

    const now = Date.now();
    const cacheKey = buildCacheKey(params);
    let cacheEntry = questionCache.get(cacheKey);

    // (Re)charger le pool si périmé/insuffisant
    if (
      !cacheEntry ||
      cacheEntry.timestamp + QUESTION_CACHE_TTL < now ||
      !Array.isArray(cacheEntry.uniqueTaxaIds) ||
      cacheEntry.uniqueTaxaIds.length < QUIZ_CHOICES
    ) {
      const obsResponse = await fetchJSON("https://api.inaturalist.org/v1/observations", params);
      const results = Array.isArray(obsResponse.results) ? obsResponse.results : [];

      if (results.length === 0) {
        return res
          .status(404)
          .json({ error: "Aucune observation trouvée avec vos critères. Élargissez la zone ou la période." });
      }

      // Regrouper par taxon avec au moins une photo
      const obsByTaxon = new Map(); // taxonId -> Observation[]
      const taxaMeta = new Map();   // taxonId -> { ancestor_ids, taxon }
      for (const o of results) {
        if (o?.taxon?.id && Array.isArray(o.photos) && o.photos.length > 0) {
          const tid = String(o.taxon.id);
          if (!obsByTaxon.has(tid)) {
            obsByTaxon.set(tid, []);
            taxaMeta.set(tid, { ancestor_ids: o.taxon.ancestor_ids || [], taxon: o.taxon });
          }
          obsByTaxon.get(tid).push(o);
        }
      }
      const uniqueTaxaIds = Array.from(obsByTaxon.keys());
      if (uniqueTaxaIds.length < QUIZ_CHOICES) {
        return res
          .status(404)
          .json({ error: "Pas assez d'espèces différentes pour créer un quiz avec ces critères." });
      }

      cacheEntry = {
        timestamp: now,
        // Nouveau pool structuré
        obsByTaxon,
        taxaMeta,
        uniqueTaxaIds,
        shuffledTaxa: shuffleFisherYates(uniqueTaxaIds),
        cursor: 0,
        // Anti-répétition par taxon
        recentTaxa: [],
        recentSet: new Set(),
        cooldown: COOL_DOWN_MS ? new Map() : null,
        // Anti-répétition par observation
        recentObsQueue: [],
        recentObsSet: new Set(),
        // Cooldown dynamique (moitié du pool, max 80)
        cooldownN: Math.min(Math.floor(uniqueTaxaIds.length / 2), 80),
      };
      setWithLimit(questionCache, cacheKey, cacheEntry);
    }

    // Exclure les taxa en cooldown (au niveau TAXON)
    const allTaxa = cacheEntry.uniqueTaxaIds;
    let eligibleTaxa = allTaxa.filter((tid) => {
      if (COOL_DOWN_MS && cacheEntry.cooldown) {
        const exp = cacheEntry.cooldown.get(String(tid));
        return !(exp && exp > now);
      } else {
        return !cacheEntry.recentSet.has(String(tid));
      }
    });

    // Relax si trop peu de candidats
    if (eligibleTaxa.length < QUIZ_CHOICES) {
      eligibleTaxa = allTaxa.slice();
    }

    // Tirage SANS REMISE sur un cycle (curseur sur liste pré-mélangée)
    const n = cacheEntry.shuffledTaxa.length || eligibleTaxa.length;
    let chosenTaxonId = null;
    let guard = 0;
    while (guard < n * 2) {
      const idx = cacheEntry.cursor % n;
      const tid = cacheEntry.shuffledTaxa[idx] || eligibleTaxa[idx % eligibleTaxa.length];
      cacheEntry.cursor = (cacheEntry.cursor + 1) % n;
      if (eligibleTaxa.includes(tid)) { chosenTaxonId = tid; break; }
      guard++;
    }
    if (!chosenTaxonId) chosenTaxonId = eligibleTaxa[0];

    // Sélection aléatoire d'une OBSERVATION au sein du taxon, en évitant les dernières utilisées
    const listForChosen = cacheEntry.obsByTaxon.get(String(chosenTaxonId)) || [];
    const poolForChosen = listForChosen.filter((o) => !cacheEntry.recentObsSet.has(o.id));
    const targetObservation = (poolForChosen.length ? poolForChosen : listForChosen)[Math.floor(Math.random() * (poolForChosen.length ? poolForChosen.length : listForChosen.length))];
    if (!targetObservation) {
      return res.status(503).json({ error: "Pool d'observations indisponible, réessayez." });
    }

    // Leurres (proches taxonomiquement si possible) — travail par TAXON
    const targetAncestorSet = new Set((cacheEntry.taxaMeta.get(String(chosenTaxonId))?.ancestor_ids) || []);
    const otherTaxa = allTaxa.filter((tid) => String(tid) !== String(chosenTaxonId));
    const scoredTaxa = otherTaxa.map((tid) => {
      const anc = (cacheEntry.taxaMeta.get(String(tid))?.ancestor_ids) || [];
      const score = anc.filter((id) => targetAncestorSet.has(id)).length;
      return { tid, score };
    }).sort((a, b) => b.score - a.score);

    const luresTaxa = [];
    const seenTaxa = new Set([String(chosenTaxonId)]);
    for (const { tid } of scoredTaxa) {
      if (!seenTaxa.has(String(tid))) {
        luresTaxa.push(String(tid));
        seenTaxa.add(String(tid));
      }
      if (luresTaxa.length >= LURE_COUNT) break;
    }
    for (const tid of allTaxa) {
      if (luresTaxa.length >= LURE_COUNT) break;
      if (!seenTaxa.has(String(tid))) {
        luresTaxa.push(String(tid));
        seenTaxa.add(String(tid));
      }
    }
    if (luresTaxa.length < LURE_COUNT) {
      return res.status(404).json({ error: "Pas assez d'espèces différentes pour composer les choix." });
    }

    // Choisir une observation aléatoire par taxon-leurre en évitant les dernières obs vues
    const lures = luresTaxa.map((tid) => {
      const list = cacheEntry.obsByTaxon.get(String(tid)) || [];
      const pool = list.filter((o) => !cacheEntry.recentObsSet.has(o.id));
      const obs = (pool.length ? pool : list)[Math.floor(Math.random() * (pool.length ? pool.length : list.length))];
      return obs;
    });

    // Détails localisés
    const allTaxonIds = [targetObservation.taxon.id, ...lures.map((o) => o.taxon.id)];
    const detailsArr = await getFullTaxaDetails(allTaxonIds, locale);
    const details = new Map(detailsArr.map((t) => [t.id, t]));
    const correct = details.get(targetObservation.taxon.id);
    if (!correct) {
      return res
        .status(502)
        .json({ error: `Impossible de récupérer les détails du taxon ${targetObservation.taxon.id}` });
    }

    const finalChoices = shuffleFisherYates([
      getTaxonName(correct),
      ...lures.map((o) => getTaxonName(details.get(o.taxon.id))),
    ]);

    const image_urls = (Array.isArray(targetObservation.photos) ? targetObservation.photos : [])
      .map((p) => (p?.url ? p.url.replace("square", "large") : null))
      .filter(Boolean);

    // Mémoriser les observations récentes pour éviter leur réutilisation trop tôt (A)
    function rememberObs(id) {
      if (!id) return;
      if (!cacheEntry.recentObsSet.has(id)) {
        cacheEntry.recentObsQueue.unshift(id);
        cacheEntry.recentObsSet.add(id);
        while (cacheEntry.recentObsQueue.length > 200) {
          const rem = cacheEntry.recentObsQueue.pop();
          cacheEntry.recentObsSet.delete(rem);
        }
      }
    }
    rememberObs(targetObservation.id);
    for (const o of lures) rememberObs(o.id);

    // Mettre cible + leurres en cooldown
    const taxaToCooldown = [targetObservation.taxon.id, ...lures.map((o) => o.taxon.id)].map(String);
    if (COOL_DOWN_MS && cacheEntry.cooldown) {
      const exp = now + COOL_DOWN_MS;
      for (const tid of taxaToCooldown) cacheEntry.cooldown.set(tid, exp);
    } else {
      for (const tid of taxaToCooldown) {
        if (!cacheEntry.recentSet.has(tid)) {
          cacheEntry.recentTaxa.unshift(tid);
          cacheEntry.recentSet.add(tid);
        }
      }
      while (cacheEntry.recentTaxa.length > (cacheEntry.cooldownN || COOL_DOWN_N)) {
        const removed = cacheEntry.recentTaxa.pop();
        cacheEntry.recentSet.delete(removed);
      }
    }

    // Entêtes debug utiles pour vérifier les répétitions côté client
    res.set("X-Quiz-Id", String(targetObservation.taxon.id));
    res.set("X-Cache-Key", cacheKey);

    res.json({
      image_urls,
      bonne_reponse: {
        id: correct.id,
        name: correct.name,
        common_name: getTaxonName(correct),
        ancestors: correct.ancestors,
        wikipedia_url: correct.wikipedia_url,
      },
      choix_mode_facile: finalChoices,
      inaturalist_url: targetObservation.uri,
    });
  })
);

// Autocomplete taxons
app.get(
  "/api/taxa/autocomplete",
  validate(autocompleteSchema),
  asyncRoute(async (req, res) => {
    const { q, rank, locale = "fr" } = req.valid; // ⬅️ lire depuis req.valid
    const now = Date.now();
    const cacheKey = buildCacheKey({ q: String(q).trim(), rank, locale });

    const cached = autocompleteCache.get(cacheKey);
    if (cached && cached.expires > now) {
      return res.json(cached.data);
    }

    const params = { q: String(q).trim(), is_active: true, per_page: 10, locale };
    if (rank) params.rank = rank;

    const data = await fetchJSON("https://api.inaturalist.org/v1/taxa/autocomplete", params);
    autocompleteCache.set(cacheKey, {
      data,
      expires: now + AUTOCOMPLETE_CACHE_TTL,
    });

    res.json(data);
  })
);

// Species counts (équilibrage / filtres)
app.get(
  "/api/observations/species_counts",
  validate(speciesCountsSchema),
  asyncRoute(async (req, res) => {
    const { lat, lng, radius, d1, d2 } = req.valid;
    const params = {
      quality_grade: "research",
      photos: true,
      rank: "species",
      per_page: 0,
      locale: "fr",
    };
    if (typeof lat === "number" && typeof lng === "number" && typeof radius === "number") {
      Object.assign(params, { lat, lng, radius });
    }
    if (d1) params.d1 = d1;
    if (d2) params.d2 = d2;

    const data = await fetchJSON("https://api.inaturalist.org/v1/observations/species_counts", params);
    res.json(data);
  })
);

/* -------------------- 404 JSON propre -------------------- */
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

/* -------------------- Démarrage -------------------- */
app.listen(PORT, () => {
  console.log(`Serveur Inaturamouche démarré sur le port ${PORT}`);
});
