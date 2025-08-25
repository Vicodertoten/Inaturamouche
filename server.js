// server.js — Inaturamouche (robuste, anti-cache API, anti-répétitions)
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
  exposedHeaders: ["Content-Length", "Content-Type", "X-Quiz-Id", "X-Cache-Key"],
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
  })
);
app.use(compression());
app.use(express.json());

/* -------------------- Politique de cache -------------------- */
// IMPORTANT : pas de cache sur l'API (sinon "toujours la même question")
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.removeHeader("ETag");
    // bonne pratique : varier aussi sur la langue
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
const COOL_DOWN_N = 50;        // ne pas revoir une espèce dans les 50 prochaines questions
const COOL_DOWN_MS = null;     // ex. 7 * 24 * 60 * 60 * 1000 pour 7 jours ; laisser null si non utilisé

const questionCache = new Map();
/*
  key = buildCacheKey(params iNat)
  value = {
    timestamp: number,
    observations: Observation[],
    recentTaxa: string[],    // queue des derniers taxons vus (si COOL_DOWN_N)
    recentSet: Set<string>,
    cooldown: Map<string, number> | null,  // taxonId -> expiresAt (si COOL_DOWN_MS)
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
      const response = await fetch(urlObj, { signal: controller.signal, headers: { Accept: "application/json" } });
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

    // Fallback en si champs manquants
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

/* -------------------- Helper routes async -------------------- */
function asyncRoute(handler) {
  return (req, res) =>
    handler(req, res).catch((err) => {
      console.error("Unhandled route error:", err);
      res.status(500).json({ error: "Erreur interne du serveur" });
    });
}

/* -------------------- Routes -------------------- */

// Santé/monitoring
app.get("/healthz", (req, res) => res.json({ ok: true }));

// Génération d’une question (sélection robuste + anti-répétitions)
app.get(
  "/api/quiz-question",
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
    } = req.query;

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
      !Array.isArray(cacheEntry.observations) ||
      cacheEntry.observations.length < QUIZ_CHOICES
    ) {
      const obsResponse = await fetchJSON("https://api.inaturalist.org/v1/observations", params);
      const results = Array.isArray(obsResponse.results) ? obsResponse.results : [];

      if (results.length === 0) {
        return res
          .status(404)
          .json({ error: "Aucune observation trouvée avec vos critères. Élargissez la zone ou la période." });
      }

      // unique par taxon avec au moins une photo
      const uniqueObs = [];
      const seenTaxa = new Set();
      for (const o of results) {
        if (o?.taxon?.id && Array.isArray(o.photos) && o.photos.length > 0 && !seenTaxa.has(o.taxon.id)) {
          uniqueObs.push(o);
          seenTaxa.add(o.taxon.id);
        }
      }
      if (uniqueObs.length < QUIZ_CHOICES) {
        return res
          .status(404)
          .json({ error: "Pas assez d'espèces différentes pour créer un quiz avec ces critères." });
      }

      cacheEntry = {
        timestamp: now,
        observations: uniqueObs,
        recentTaxa: [],
        recentSet: new Set(),
        cooldown: COOL_DOWN_MS ? new Map() : null,
      };
      setWithLimit(questionCache, cacheKey, cacheEntry);
    }

    // Exclure les taxa en cooldown
    let candidates = cacheEntry.observations.slice();
    if (COOL_DOWN_MS && cacheEntry.cooldown) {
      // purge expirés
      for (const [tid, exp] of cacheEntry.cooldown.entries()) {
        if (exp <= now) cacheEntry.cooldown.delete(tid);
      }
      candidates = candidates.filter((o) => !cacheEntry.cooldown.has(String(o.taxon.id)));
    } else {
      candidates = candidates.filter((o) => !cacheEntry.recentSet.has(String(o.taxon.id)));
    }

    // Relax si trop peu de candidats
    if (candidates.length < QUIZ_CHOICES) {
      candidates = cacheEntry.observations.slice();
    }

    candidates = shuffleFisherYates(candidates);

    const targetObservation = candidates[0];
    if (!targetObservation) {
      return res.status(503).json({ error: "Pool d'observations indisponible, réessayez." });
    }

    // Leurres (proches taxonomiquement si possible)
    const targetAncestorSet = new Set(targetObservation?.taxon?.ancestor_ids || []);
    const scored = candidates.slice(1).map((o) => ({
      obs: o,
      score: (o?.taxon?.ancestor_ids || []).filter((id) => targetAncestorSet.has(id)).length,
    }));
    scored.sort((a, b) => b.score - a.score);

    const lures = [];
    const seen = new Set([targetObservation.taxon.id]);
    for (const { obs } of scored) {
      if (!seen.has(obs.taxon.id)) {
        lures.push(obs);
        seen.add(obs.taxon.id);
      }
      if (lures.length >= LURE_COUNT) break;
    }
    for (const o of candidates) {
      if (lures.length >= LURE_COUNT) break;
      if (!seen.has(o.taxon.id)) {
        lures.push(o);
        seen.add(o.taxon.id);
      }
    }
    if (lures.length < LURE_COUNT) {
      return res.status(404).json({ error: "Pas assez d'espèces différentes pour composer les choix." });
    }

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
      while (cacheEntry.recentTaxa.length > COOL_DOWN_N) {
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
  asyncRoute(async (req, res) => {
    const { q, rank, locale = "fr" } = req.query;
    if (!q || String(q).trim().length < 2) return res.json([]);

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

/* -------------------- 404 JSON propre -------------------- */
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

/* -------------------- Démarrage -------------------- */
app.listen(PORT, () => {
  console.log(`Serveur Inaturamouche démarré sur le port ${PORT}`);
});
