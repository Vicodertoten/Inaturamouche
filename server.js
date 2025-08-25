// server.js — Inaturamouche (durci + observabilité + validation)
// Basé sur ta version existante avec logique quiz/caches/anti-répétitions, enrichi :
// - Helmet avec CSP + Referrer-Policy
// - Pino logs HTTP
// - Rate-limit global + spécifique quiz (~1 req/s)
// - Validation Zod (quiz, autocomplete, species_counts)
// - Endpoint /api/observations/species_counts
// - Healthcheck /healthz (warm-up Render)
//
// Patch ABCD appliqué :
// A) Cooldown par observation (file/Set des dernières obs utilisées)
// B) Sélection aléatoire d’une observation au sein d’un taxon (en excluant les obs récentes si possible)
// C) Tirage SANS REMISE pour la cible via une liste de taxons pré-mélangée + curseur par cycle de cache
// D) Cooldown taxon relevé (>= 50) — ici réglé à 60
//
// + Ajouts demandés :
// - 2e passage "relaxed" pour compléter les leurres en ignorant recentSet/cooldown
// - Extension du pool au refresh (jusqu’à 3 pages max) si trop peu d’espèces distinctes

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

/* -------------------- PROXY (Render/Cloudflare) -------------------- */
// IMPORTANT: nécessaire pour que express-rate-limit identifie correctement les IP
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
  exposedHeaders: ["Content-Length", "Content-Type", "X-Quiz-Id", "X-Cache-Key", "X-Quiz-Obs-Id"],
};

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
app.disable("x-powered-by"); // durcissement
app.set("etag", false);       // pas d'ETag global (on gère le cache ci-dessous)

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
// Global pour /api : 300 req / 15 min / IP
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

// Spécifique quiz : ~1 req/s (60/min)
const quizLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

/* -------------------- Politique de cache -------------------- */
// IMPORTANT : pas de cache sur l'API (sinon "toujours la même question")
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

// Anti-répétitions (D) : on vise ≥ 50 — on met 60 par défaut
const COOL_DOWN_N = 60;        // ne pas revoir une ESPÈCE dans les 60 prochaines questions
const COOL_DOWN_MS = null;     // ex. 7 * 24 * 60 * 60 * 1000 ; laisser null si non utilisé

// (A) Anti-répétition par OBSERVATION (évite de revoir la même photo trop vite)
const RECENT_OBS_MAX = 200; // taille mémoire des dernières observations utilisées (cible)

// Extension du pool (refresh)
const MAX_OBS_PAGES = 3;              // jusqu'à 3 pages max par refresh
const DISTINCT_TAXA_TARGET = 120;     // seuil d'espèces distinctes pour arrêter tôt

const questionCache = new Map();
/*
  key = buildCacheKey(params iNat)
  value = {
    timestamp: number,
    // (C) Pool structuré par taxon pour tirage sans remise
    byTaxon: Map<taxonId, Observation[]>, // observations (avec photos) groupées par taxon
    taxonList: string[],                  // tous les taxonIds du pool
    shuffledTaxonIds: string[],           // ordre pré-mélangé pour le cycle courant
    cursor: number,                       // curseur "sans remise" pour la CIBLE

    // (D) Cooldown d'espèces
    recentTaxa: string[],                 // queue des derniers taxons vus (si COOL_DOWN_N)
    recentSet: Set<string>,
    cooldown: Map<string, number> | null, // taxonId -> expiresAt (si COOL_DOWN_MS)

    // (A) Cooldown d'observations (pour la CIBLE affichée)
    recentObsQueue: string[],             // FIFO des dernières observation_id vues
    recentObsSet: Set<string>,            // membership O(1)
  }
*/
const autocompleteCache = new Map();

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

/* -------------------- Helpers ABCD -------------------- */

// (A) Mémoriser une observation vue (cible)
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

// (B) Choisir une observation aléatoire dans un taxon, en excluant si possible les obs récentes
function pickObservationForTaxon(cacheEntry, taxonId) {
  const list = cacheEntry.byTaxon.get(String(taxonId)) || [];
  if (list.length === 0) return null;
  const pool = list.filter(o => !cacheEntry.recentObsSet.has(String(o.id)));
  const arr = pool.length ? pool : list;
  return arr[Math.floor(Math.random() * arr.length)];
}

// (C) Prochain taxon éligible selon le curseur "sans remise"
function nextEligibleTaxonId(cacheEntry, now, excludeSet = new Set()) {
  const n = cacheEntry.shuffledTaxonIds.length;
  if (n === 0) return null;

  // petite fonction utilitaire de test d'éligibilité
  const isEligible = (tid) => {
    const key = String(tid);
    if (excludeSet.has(key)) return false;
    if (!cacheEntry.byTaxon.get(key)?.length) return false; // aucun média
    if (COOL_DOWN_MS && cacheEntry.cooldown) {
      // purge expirés
      for (const [t, exp] of cacheEntry.cooldown.entries()) {
        if (exp <= now) cacheEntry.cooldown.delete(t);
      }
      if (cacheEntry.cooldown.has(key)) return false;
    } else {
      if (cacheEntry.recentSet.has(key)) return false;
    }
    return true;
  };

  let scanned = 0;
  while (scanned < n) {
    if (cacheEntry.cursor >= n) {
      cacheEntry.shuffledTaxonIds = shuffleFisherYates(cacheEntry.shuffledTaxonIds);
      cacheEntry.cursor = 0;
    }
    const tid = cacheEntry.shuffledTaxonIds[cacheEntry.cursor++];
    scanned++;
    if (isEligible(tid)) return String(tid);
  }

  // Fallback : si tout est "bloqué", on retourne le premier avec contenu
  for (const tid of cacheEntry.shuffledTaxonIds) {
    if (cacheEntry.byTaxon.get(String(tid))?.length) return String(tid);
  }
  return null;
}

/* -------------------- Helper routes async -------------------- */
function asyncRoute(handler) {
  return (req, res) =>
    handler(req, res).catch((err) => {
      console.error("Unhandled route error:", err);
      res.status(500).json({ error: "Erreur interne du serveur" });
    });
}

/* -------------------- Validation (Zod) -------------------- */
const stringOrArray = z.union([z.string(), z.array(z.string())]);

const quizSchema = z.object({
  pack_id: z.string().optional(),
  taxon_ids: stringOrArray.optional(),
  include_taxa: stringOrArray.optional(),
  exclude_taxa: stringOrArray.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(200).optional(),
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
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(200).optional(),
  d1: z.string().optional(),
  d2: z.string().optional(),
  locale: z.string().default("fr"),
  per_page: z.coerce.number().min(1).max(200).default(100),
  page: z.coerce.number().min(1).max(500).default(1),
});

// ⚠️ Express 5: req.query est en lecture seule → on n'y écrit plus.
// On pose la version validée sur req.valid et on l'utilise dans les routes.
function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse({ ...req.query, ...req.body });
    if (!parsed.success) return res.status(400).json({ error: "Bad request", issues: parsed.error.issues });
    req.valid = parsed.data;
    next();
  };
}

/* -------------------- Routes -------------------- */

// Santé/monitoring — warm-up Render
app.get("/healthz", (req, res) => res.json({ ok: true }));

// Génération d’une question (sélection robuste + anti-répétitions)
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
    } = req.valid; // ⬅️ lire depuis req.valid

    // Paramètres iNat
    const params = {
      quality_grade: "research",
      photos: true,
      rank: "species",
      per_page: 200,
      locale,
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
      !cacheEntry.byTaxon ||
      !Array.isArray(cacheEntry.taxonList) ||
      cacheEntry.taxonList.length < QUIZ_CHOICES
    ) {
      // --- Extension du pool : jusqu'à 3 pages max si distinct taxa faible ---
      let page = 1;
      let results = [];
      let distinctTaxaSet = new Set();

      while (page <= MAX_OBS_PAGES) {
        const resp = await fetchJSON("https://api.inaturalist.org/v1/observations", { ...params, page });
        const batch = Array.isArray(resp.results) ? resp.results : [];
        results = results.concat(batch);

        // calcule un set d'espèces distinctes avec photo
        distinctTaxaSet = new Set(
          results
            .filter(o => o?.taxon?.id && Array.isArray(o.photos) && o.photos.length > 0)
            .map(o => o.taxon.id)
        );

        if (distinctTaxaSet.size >= DISTINCT_TAXA_TARGET) break; // on a un pool confortable
        // si la page courante ne ramène rien, inutile d'insister
        if (batch.length === 0) break;

        page++;
      }

      if (results.length === 0) {
        return res
          .status(404)
          .json({ error: "Aucune observation trouvée avec vos critères. Élargissez la zone ou la période." });
      }

      // (B) & (C) — on regroupe toutes les observations par taxon (avec photos), sans dédupliquer à 1 seule
      const byTaxon = new Map(); // taxonId -> Observation[]
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
        recentTaxa: [],
        recentSet: new Set(),
        cooldown: COOL_DOWN_MS ? new Map() : null,
        recentObsQueue: [],
        recentObsSet: new Set(),
      };
      setWithLimit(questionCache, cacheKey, cacheEntry);
    }

    // (C) Choisir la CIBLE par tirage sans remise via le curseur + exclusions
    const excludeTaxaForTarget = new Set(); // au cas où on veut forcer des exclusions supplémentaires
    let targetTaxonId = nextEligibleTaxonId(cacheEntry, now, excludeTaxaForTarget);
    if (!targetTaxonId) {
      return res.status(503).json({ error: "Pool d'observations indisponible, réessayez." });
    }

    // (B) Observation aléatoire dans le taxon cible (en excluant si possible les obs récentes)
    let targetObservation = pickObservationForTaxon(cacheEntry, targetTaxonId);
    if (!targetObservation) {
      return res.status(503).json({ error: "Aucune observation exploitable trouvée pour le taxon cible." });
    }

    // (A) Mémoriser l’observation utilisée pour éviter sa réapparition trop tôt
    rememberObservation(cacheEntry, targetObservation.id);

    // --- Construction des leurres ---
    // On privilégie les leurres proches taxonomiquement si possible.
    // On constitue des candidats "hors cible" en tenant compte des cooldowns taxon
    const isTaxonEligibleNow = (tid) => {
      const key = String(tid);
      if (key === String(targetTaxonId)) return false;
      if (!cacheEntry.byTaxon.get(key)?.length) return false;
      if (COOL_DOWN_MS && cacheEntry.cooldown) {
        if (cacheEntry.cooldown.get(key) > now) return false;
      } else if (cacheEntry.recentSet.has(key)) {
        return false;
      }
      return true;
    };

    const targetAncestors = new Set(
      (Array.isArray(targetObservation?.taxon?.ancestor_ids) ? targetObservation.taxon.ancestor_ids : [])
    );

    // Liste des taxons candidats pour les leurres (strict = respecte cooldown/recentSet)
    const lureCandidatesTaxa = cacheEntry.taxonList.filter(isTaxonEligibleNow);

    // Représentant d’un taxon (on peut prendre la première obs dispo)
    const reprObsForTaxon = (tid) => {
      const list = cacheEntry.byTaxon.get(String(tid)) || [];
      return list[0] || null;
    };

    // Score de proximité taxonomique
    const scored = lureCandidatesTaxa.map((tid) => {
      const rep = reprObsForTaxon(tid);
      const anc = new Set(Array.isArray(rep?.taxon?.ancestor_ids) ? rep.taxon.ancestor_ids : []);
      let overlap = 0;
      for (const id of anc) if (targetAncestors.has(id)) overlap++;
      return { tid: String(tid), rep, score: overlap };
    });

    scored.sort((a, b) => b.score - a.score);

    const lures = [];
    const seenTaxa = new Set([String(targetTaxonId)]);
    for (const { tid, rep } of scored) {
      if (lures.length >= LURE_COUNT) break;
      if (!seenTaxa.has(tid)) {
        // observation aléatoire pour ce taxon (variété d'images)
        const obs = pickObservationForTaxon(cacheEntry, tid) || rep;
        if (obs) {
          lures.push({ taxonId: tid, obs });
          seenTaxa.add(tid);
        }
      }
    }

    // Si pas assez de leurres, on comble aléatoirement parmi les restants éligibles (toujours strict)
    if (lures.length < LURE_COUNT) {
      const fallbackPool = shuffleFisherYates(lureCandidatesTaxa);
      for (const tid of fallbackPool) {
        if (lures.length >= LURE_COUNT) break;
        if (seenTaxa.has(String(tid))) continue;
        const obs = pickObservationForTaxon(cacheEntry, tid) || reprObsForTaxon(tid);
        if (obs) {
          lures.push({ taxonId: String(tid), obs });
          seenTaxa.add(String(tid));
        }
      }
    }

    // --- 2e passage RELAXÉ : ignorer recentSet/cooldown pour compléter jusqu’à LURE_COUNT ---
    if (lures.length < LURE_COUNT) {
      const relaxedTaxa = cacheEntry.taxonList.filter(tid =>
        String(tid) !== String(targetTaxonId) &&
        (cacheEntry.byTaxon.get(String(tid))?.length)
      );
      for (const tid of shuffleFisherYates(relaxedTaxa)) {
        if (lures.length >= LURE_COUNT) break;
        if (seenTaxa.has(String(tid))) continue;
        const obs = pickObservationForTaxon(cacheEntry, tid) || reprObsForTaxon(tid);
        if (obs) {
          lures.push({ taxonId: String(tid), obs });
          seenTaxa.add(String(tid));
        }
      }
    }

    if (lures.length < LURE_COUNT) {
      return res.status(404).json({ error: "Pas assez d'espèces différentes pour composer les choix." });
    }

    // Détails localisés (noms/fr/wikipedia)
    const allTaxonIds = [String(targetTaxonId), ...lures.map((l) => String(l.taxonId))];
    const detailsArr = await getFullTaxaDetails(allTaxonIds, locale);
    const details = new Map(detailsArr.map((t) => [String(t.id), t]));
    const correct = details.get(String(targetTaxonId));
    if (!correct) {
      return res
        .status(502)
        .json({ error: `Impossible de récupérer les détails du taxon ${targetTaxonId}` });
    }

    const finalChoices = shuffleFisherYates([
      getTaxonName(correct),
      ...lures.map((l) => getTaxonName(details.get(String(l.taxonId)))),
    ]);

    const image_urls = (Array.isArray(targetObservation.photos) ? targetObservation.photos : [])
      .map((p) => (p?.url ? p.url.replace("square", "large") : null))
      .filter(Boolean);

    // (D) Mettre la cible + les leurres en cooldown taxon
    const taxaToCooldown = [String(targetTaxonId), ...lures.map((l) => String(l.taxonId))];
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
      while (cacheEntry.recentTaxa.length > COOL_DOWN_N) {
        const removed = cacheEntry.recentTaxa.pop();
        cacheEntry.recentSet.delete(removed);
      }
    }

    // Entêtes debug utiles pour vérifier les répétitions côté client
    res.set("X-Quiz-Id", String(targetTaxonId));
    res.set("X-Quiz-Obs-Id", String(targetObservation.id));
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
  })
);

// Détail d’un taxon
app.get(
  "/api/taxon/:id",
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { locale = "fr" } = req.query;
    const response = await fetchJSON(`https://api.inaturalist.org/v1/taxa/${id}`, { locale });
    const result = Array.isArray(response.results) ? response.results[0] : undefined;
    if (!result) return res.status(404).json({ error: "Taxon non trouvé." });
    res.json(result);
  })
);

// Batch de taxons
app.get(
  "/api/taxa",
  asyncRoute(async (req, res) => {
    const { ids, locale = "fr" } = req.query;
    if (!ids) return res.status(400).json({ error: "Le paramètre 'ids' est requis." });

    const taxonIds = String(ids)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const taxaDetails = await getFullTaxaDetails(taxonIds, locale);
    res.json(taxaDetails);
  })
);

// Species counts (équilibrage / filtres)
app.get(
  "/api/observations/species_counts",
  validate(speciesCountsSchema),
  asyncRoute(async (req, res) => {
    const {
      taxon_ids,
      include_taxa,
      exclude_taxa,
      lat,
      lng,
      radius,
      d1,
      d2,
      locale,
      per_page,
      page,
    } = req.valid; // ⬅️ lire depuis req.valid

    const params = {
      locale,
      per_page,
      page,
      verifiable: true,
      quality_grade: "research",
    };

    if (taxon_ids) params.taxon_id = taxon_ids;
    if (include_taxa) params.taxon_id = include_taxa;
    if (exclude_taxa) params.without_taxon_id = exclude_taxa;
    if (lat != null && lng != null && radius != null) Object.assign(params, { lat, lng, radius });
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
