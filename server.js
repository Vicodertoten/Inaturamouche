// server.js
import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import PACKS from "./shared/packs.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

/* -------------------- CORS en premier -------------------- */
const allowedOrigins = [
  "http://localhost:5173",
  "https://inaturamouche.netlify.app",
  "https://inaturaquizz.netlify.app",
];

const corsOptions = {
  origin(origin, cb) {
    // Autorise aussi les requêtes sans Origin (curl, CRON, santé…)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Origin not allowed by CORS"));
  },
  credentials: true, // Mets false si tu n’utilises ni cookies ni Authorization côté navigateur
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  exposedHeaders: ["Content-Length", "Content-Type"],
};

app.use(cors(corsOptions));
// ⚠️ Pas de route OPTIONS catch-all ici (Express 5 n’aime pas les wildcards mal nommés)
// Le middleware cors() gère déjà les preflights pour toutes les routes.

// Aide au cache des proxy/CDN
app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

/* -------------------- Sécurité & perfs -------------------- */
app.use(
  helmet({
    crossOriginResourcePolicy: false, // évite des blocages inutiles sur API JSON
  })
);
app.use(compression());
app.use(express.json());

/* -------------------- Cache HTTP générique -------------------- */
app.use((req, res, next) => {
  res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  next();
});

/* -------------------- Utils -------------------- */
async function fetchJSON(url, params = {}) {
  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      urlObj.searchParams.append(key, value);
    }
  }
  const response = await fetch(urlObj);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function getFullTaxaDetails(taxonIds, locale = "fr") {
  if (!taxonIds || taxonIds.length === 0) return [];
  try {
    const localizedResponse = await fetchJSON(
      `https://api.inaturalist.org/v1/taxa/${taxonIds.join(",")}`,
      { locale }
    );
    const localizedResults = Array.isArray(localizedResponse.results) ? localizedResponse.results : [];

    if (!locale.startsWith("en") && localizedResults.length > 0) {
      const defaultResponse = await fetchJSON(
        `https://api.inaturalist.org/v1/taxa/${taxonIds.join(",")}`
      );
      const defaultResults = Array.isArray(defaultResponse.results) ? defaultResponse.results : [];
      const byId = new Map(defaultResults.map((t) => [t.id, t]));

      return localizedResults.map((loc) => {
        const def = byId.get(loc.id);
        if (!loc.wikipedia_url && def && def.wikipedia_url) {
          loc.wikipedia_url = def.wikipedia_url;
        }
        return loc;
      });
    }
    return localizedResults;
  } catch (err) {
    console.error("Erreur lors de la récupération des détails des taxons:", err.message);
    return [];
  }
}

function getTaxonName(taxon) {
  if (!taxon) return "Nom introuvable";
  return taxon.preferred_common_name || taxon.name;
}

/* -------------------- Routes -------------------- */

// Santé/monitoring
app.get("/healthz", (req, res) => {
  res.json({ ok: true });
});

// Génération d’une question de quiz
app.get("/api/quiz-question", async (req, res) => {
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

  const params = {
    quality_grade: "research",
    photos: true,
    rank: "species",
    per_page: 200,
    locale,
  };

  if (pack_id) {
    const selectedPack = PACKS.find((p) => p.id === pack_id);
    if (selectedPack && selectedPack.api_params) Object.assign(params, selectedPack.api_params);
  } else if (taxon_ids) {
    params.taxon_id = Array.isArray(taxon_ids) ? taxon_ids.join(",") : taxon_ids;
  } else if (include_taxa || exclude_taxa) {
    if (include_taxa) params.taxon_id = Array.isArray(include_taxa) ? include_taxa.join(",") : include_taxa;
    if (exclude_taxa) params.without_taxon_id = Array.isArray(exclude_taxa) ? exclude_taxa.join(",") : exclude_taxa;
  }

  if (lat && lng && radius) Object.assign(params, { lat, lng, radius });
  if (d1) params.d1 = d1;
  if (d2) params.d2 = d2;

  try {
    const obsResponse = await fetchJSON("https://api.inaturalist.org/v1/observations", params);
    const results = Array.isArray(obsResponse.results) ? obsResponse.results : [];
    if (results.length === 0) throw new Error("Aucune observation trouvée avec vos critères. Essayez d'élargir votre recherche.");

    const shuffledObs = results
      .filter((o) => o.taxon && Array.isArray(o.photos) && o.photos.length > 0 && o.taxon.ancestor_ids)
      .sort(() => 0.5 - Math.random());

    if (shuffledObs.length < 4) throw new Error("Pas assez d'espèces différentes trouvées pour créer un quiz.");

    const [targetObservation, ...candidateObs] = shuffledObs;
    const targetAncestorSet = new Set(targetObservation.taxon.ancestor_ids || []);

    const scoredCandidates = candidateObs
      .filter((o) => o.taxon && o.taxon.id !== targetObservation.taxon.id)
      .map((o) => ({
        obs: o,
        score: (o.taxon.ancestor_ids || []).filter((id) => targetAncestorSet.has(id)).length,
      }))
      .sort((a, b) => b.score - a.score);

    const lureObservations = [];
    const seen = new Set([targetObservation.taxon.id]);
    for (const { obs } of scoredCandidates) {
      if (!seen.has(obs.taxon.id)) {
        lureObservations.push(obs);
        seen.add(obs.taxon.id);
      }
      if (lureObservations.length >= 3) break;
    }
    if (lureObservations.length < 3) throw new Error("Pas assez d'espèces différentes trouvées pour créer un quiz.");

    const allTaxonIds = [targetObservation.taxon.id, ...lureObservations.map((o) => o.taxon.id)];
    const allTaxaDetails = await getFullTaxaDetails(allTaxonIds, locale);
    const details = new Map(allTaxaDetails.map((t) => [t.id, t]));
    const correct = details.get(targetObservation.taxon.id);
    if (!correct) throw new Error(`Impossible de récupérer les détails du taxon (ID: ${targetObservation.taxon.id})`);

    const finalChoices = [
      getTaxonName(correct),
      ...lureObservations.map((o) => getTaxonName(details.get(o.taxon.id))),
    ].sort(() => Math.random() - 0.5);

    res.json({
      image_urls: (targetObservation.photos || []).map((p) => p.url.replace("square", "large")),
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
  } catch (err) {
    console.error("Erreur dans /api/quiz-question:", err.message);
    res.status(500).json({ error: "Erreur interne du serveur: " + err.message });
  }
});

// Autocomplete taxons
app.get("/api/taxa/autocomplete", async (req, res) => {
  const { q, rank, locale = "fr" } = req.query;
  if (!q || q.length < 2) return res.json([]);

  try {
    const params = { q, is_active: true, per_page: 10, locale };
    if (rank) params.rank = rank;

    const response = await fetchJSON("https://api.inaturalist.org/v1/taxa/autocomplete", params);
    const initial = Array.isArray(response.results) ? response.results : [];
    if (initial.length === 0) return res.json([]);

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

    res.json(out);
  } catch (err) {
    console.error("Erreur dans /api/taxa/autocomplete:", err.message);
    res.status(500).json({ error: "Erreur lors de la recherche." });
  }
});

// Détail d’un taxon
app.get("/api/taxon/:id", async (req, res) => {
  const { id } = req.params;
  const { locale = "fr" } = req.query;

  try {
    const response = await fetchJSON(`https://api.inaturalist.org/v1/taxa/${id}`, { locale });
    const result = Array.isArray(response.results) ? response.results[0] : undefined;
    if (!result) return res.status(404).json({ error: "Taxon non trouvé." });
    res.json(result);
  } catch {
    res.status(404).json({ error: "Taxon non trouvé." });
  }
});

// Batch de taxons
app.get("/api/taxa", async (req, res) => {
  const { ids, locale = "fr" } = req.query;
  if (!ids) return res.status(400).json({ error: "Le paramètre 'ids' est requis." });

  const taxonIds = ids
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    const taxaDetails = await getFullTaxaDetails(taxonIds, locale);
    res.json(taxaDetails);
  } catch (err) {
    console.error("Erreur dans /api/taxa:", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des taxons." });
  }
});

/* -------------------- 404 JSON propre -------------------- */
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

/* -------------------- Démarrage -------------------- */
app.listen(PORT, () => {
  console.log(`Serveur Inaturamouche démarré sur le port ${PORT}`);
});
