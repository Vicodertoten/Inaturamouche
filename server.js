// server.js — version améliorée
import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import PACKS from "./shared/packs.js";

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
  exposedHeaders: ["Content-Length", "Content-Type"],
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

/* -------------------- Cache HTTP générique -------------------- */
app.use((req, res, next) => {
  // APIs peuvent être mises en cache brièvement côté CDN
  res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  next();
});

/* -------------------- Constantes & caches -------------------- */
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2; // 1 tentative + 2 retries = 3 au total
const QUESTION_CACHE_TTL = 1000 * 60 * 5; // 5 min
const AUTOCOMPLETE_CACHE_TTL = 1000 * 60 * 10; // 10 min
const MAX_CACHE_ENTRIES = 50;
const QUIZ_CHOICES = 4;
const LURE_COUNT = QUIZ_CHOICES - 1;

// Cooldown : activer l'un des deux (par défaut : basé sur N dernières questions)
const COOL_DOWN_N = 50; // ne pas revoir la même espèce dans les 50 prochaines questions
const COOL_DOWN_MS = null; // ex. 7 * 24 * 60 * 60 * 1000 pour 7 jours ; laisse null pour désactiver le temps

const questionCache = new Map();
/*
  value = {
    timestamp: number,
    observations: Observation[],
    // anti-répétition :
    recentTaxa: string[] (queue, taille <= COOL_DOWN_N), recentSet: Set<string>,
    // OU (si COOL_DOWN_MS) : cooldown: Map<taxonId:string, expiresAt:number>
  }
*/
const autocompleteCache = new Map();

/* -------------------- Utils génériques -------------------- */
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

/* -------------------- fetch JSON (timeout + retry) -------------------- */
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
      const response = await fetch(urlObj, { signal: controller.signal, headers: { "Accept": "application/json" } });
      clearTimeout(timer);
      if (!response.ok) {
        // Si iNat dit 429/5xx → retry exponentiel
        if ((response.status >= 500 || response.status === 429) && attempt < retries) {
          attempt++;
          await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt))); // 300ms, 600ms, 1200ms
          continue;
        }
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${response.statusText} — ${text.slice(0, 200)}`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      // Timeout/abort ou réseau → retry si possible
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
  // ids < 30, donc un seul appel ; si besoin, chunker par 30
  try {
    const path = `https://api.inaturalist.org/v1/taxa/${taxonIds.join(",")}`;
    const localizedResponse = await fetchJSON(path, { locale });
    const localizedResults = Array.isArray(localizedResponse.results) ? localizedResponse.results : [];

    // Fallback EN si certains champs manquent (wikipedia_url, common_name…)
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

function getTaxonName(taxon) {
  if (!taxon) return "Nom introuvable";
  return taxon.preferred_common_name || taxon.name || "Nom introuvable";
}

/* -------------------- Middlewares utilitaires -------------------- */
function asyncRoute(handler) {
  return (req, res) => handler(req, res).catch((err) => {
    console.error("Unhandled route error:", err);
    res.status(500).json({ error: "Erreur interne du serveur" });
  });
}

/* -------------------- Routes -------------------- */

// Santé/monitoring
app.get("/healthz", (req, res) => res.json({ ok: true }));

// Génération d’une question de quiz (anti-répétition + cooldown)
app.get("/api/quiz-question", asyncRoute(async (req, res) => {
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

  // Sanitize/normalise les paramètres iNat
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
  const radiusNum = clampNumber(radius, 0, 200); // km max 200 pour éviter abus

  if (latNum !== null && lngNum !== null && radiusNum !== null) {
    Object.assign(params, { lat: latNum, lng: lngNum, radius: radiusNum });
  }
  if (d1 && isValidISODate(d1)) params.d1 = d1;
  if (d2 && isValidISODate(d2)) params.d2 = d2;

  const now = Date.now();
  const cacheKey = buildCacheKey(params);
  let cacheEntry = questionCache.get(cacheKey);

  // (Re)charger le pool si périmé ou insuffisant
  if (!cacheEntry || cacheEntry.timestamp + QUESTION_CACHE_TTL < now || !Array.isArray(cacheEntry.observations) || cacheEntry.observations.length < QUIZ_CHOICES) {
    const obsResponse = await fetchJSON("https://api.inaturalist.org/v1/observations", params);
    const results = Array.isArray(obsResponse.results) ? obsResponse.results : [];

    if (results.length === 0) {
      // Ne renvoie pas 500 ici : retour propre
      return res.status(404).json({ error: "Aucune observation trouvée avec vos critères. Élargissez la zone ou la période." });
    }

    // Unique par taxon, avec photo
    const uniqueObs = [];
    const seenTaxa = new Set();
    for (const o of results) {
      if (o?.taxon?.id && Array.isArray(o.photos) && o.photos.length > 0 && !seenTaxa.has(o.taxon.id)) {
        uniqueObs.push(o);
        seenTaxa.add(o.taxon.id);
      }
    }
    if (uniqueObs.length < QUIZ_CHOICES) {
      return res.status(404).json({ error: "Pas assez d'espèces différentes pour créer un quiz avec ces critères." });
    }

    // Initialise l’entrée de cache
    cacheEntry = {
      timestamp: now,
      observations: uniqueObs,
      recentTaxa: [],                // file des derniers taxa utilisés (IDs sous forme de string)
      recentSet: new Set(),          // pour lookup O(1)
      cooldown: COOL_DOWN_MS ? new Map() : null, // si tu actives le cooldown temporel
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
    // cooldown basé sur N dernières questions
    candidates = candidates.filter((o) => !cacheEntry.recentSet.has(String(o.taxon.id)));
  }

  // Si trop peu de candidats, on relaxe le cooldown (mais on garde la diversité)
  if (candidates.length < QUIZ_CHOICES) {
    candidates = cacheEntry.observations.slice();
  }

  // Mélanger
  candidates = shuffleFisherYates(candidates);

  // Choisir la cible
  const targetObservation = candidates[0];
  if (!targetObservation) {
    // Très rare : fallback ultra prudent
    return res.status(503).json({ error: "Pool d'observations indisponible, réessayez." });
  }

  // Choisir des leurres (espèces proches taxonomiquement de préférence)
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
  // Fallback si on n'a pas assez de leurres "proches"
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

  // Récupérer les détails localisés
  const allTaxonIds = [targetObservation.taxon.id, ...lures.map((o) => o.taxon.id)];
  const detailsArr = await getFullTaxaDetails(allTaxonIds, locale);
  const details = new Map(detailsArr.map((t) => [t.id, t]));
  const correct = details.get(targetObservation.taxon.id);
  if (!correct) {
    return res.status(502).json({ error: `Impossible de récupérer les détails du taxon ${targetObservation.taxon.id}` });
  }

  // Libellés finaux (avec fallback nom scientifique)
  const finalChoices = shuffleFisherYates([
    getTaxonName(correct),
    ...lures.map((o) => getTaxonName(details.get(o.taxon.id))),
  ]);

  // Images en taille "large" (fallback au cas où)
  const image_urls = (Array.isArray(targetObservation.photos) ? targetObservation.photos : [])
    .map((p) => (p?.url ? p.url.replace("square", "large") : null))
    .filter(Boolean);

  // Mettre la cible et les leurres en cooldown
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
    // tronquer à COOL_DOWN_N
    while (cacheEntry.recentTaxa.length > COOL_DOWN_N) {
      const removed = cacheEntry.recentTaxa.pop();
      cacheEntry.recentSet.delete(removed);
    }
  }

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
}));

// Autocomplete taxons (durci)
app.get("/api/taxa/autocomplete", asyncRoute(async (req, res) => {
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
}));

// Détail d’un taxon
app.get("/api/taxon/:id", asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { locale = "fr" } = req.query;
  const response = await fetchJSON(`https://api.inaturalist.org/v1/taxa/${id}`, { locale });
  const result = Array.isArray(response.results) ? response.results[0] : undefined;
  if (!result) return res.status(404).json({ error: "Taxon non trouvé." });
  res.json(result);
}));

// Batch de taxons
app.get("/api/taxa", asyncRoute(async (req, res) => {
  const { ids, locale = "fr" } = req.query;
  if (!ids) return res.status(400).json({ error: "Le paramètre 'ids' est requis." });
  const taxonIds = String(ids)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const taxaDetails = await getFullTaxaDetails(taxonIds, locale);
  res.json(taxaDetails);
}));

/* -------------------- 404 JSON propre -------------------- */
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

/* -------------------- Démarrage -------------------- */
app.listen(PORT, () => {
  console.log(`Serveur Inaturamouche démarré sur le port ${PORT}`);
});
