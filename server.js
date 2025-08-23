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

/* -------------------- CORS (en premier) -------------------- */
const allowedOrigins = [
  "http://localhost:5173",
  "https://inaturamouche.netlify.app",
  "https://inaturaquizz.netlify.app",
];

const corsOptions = {
  origin(origin, cb) {
    // Autorise aussi les requêtes sans Origin (ex: curl, CRON)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Origin not allowed by CORS"));
  },
  credentials: true, // Mets false si tu n’utilises ni cookies ni Authorization côté navigateur
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  exposedHeaders: ["Content-Length", "Content-Type"],
};

app.use(cors(corsOptions));
// Preflight global compatible Express 5 (éviter '*')
app.options("/:path*", cors(corsOptions));

// Pour le cache côté proxy/CDN
app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

/* -------------------- Sécurité & perfs -------------------- */
app.use(
  helmet({
    // Évite CORP strict pour les ressources cross-origin (API JSON)
    crossOriginResourcePolicy: false,
  })
);
app.use(compression());

// Parser JSON (utile si tu ajoutes des POST/PUT)
app.use(express.json());

/* -------------------- Cache HTTP générique -------------------- */
app.use((req, res, next) => {
  res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  next();
});

/* -------------------- Utils -------------------- */

// Utilitaire fetch JSON avec query params
async function fetchJSON(url, params = {}) {
  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      urlObj.searchParams.append(key, value);
    }
  }
  const response = await fetch(urlObj);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

// Récupère les détails de taxons, avec fallback pour wikipedia_url si manquant en locale != en
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
      const defaultDetailsMap = new Map(defaultResults.map((t) => [t.id, t]));

      const finalResults = localizedResults.map((localizedTaxon) => {
        const defaultTaxon = defaultDetailsMap.get(localizedTaxon.id);
        if (!localizedTaxon.wikipedia_url && defaultTaxon && defaultTaxon.wikipedia_url) {
          localizedTaxon.wikipedia_url = defaultTaxon.wikipedia_url;
        }
        return localizedTaxon;
      });

      return finalResults;
    }

    return localizedResults;
  } catch (error) {
    console.error("Erreur lors de la récupération des détails des taxons:", error.message);
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
    if (selectedPack && selectedPack.api_params) {
      Object.assign(params, selectedPack.api_params);
    }
  } else if (taxon_ids) {
    params.taxon_id = Array.isArray(taxon_ids) ? taxon_ids.join(",") : taxon_ids;
  } else if (include_taxa || exclude_taxa) {
    if (include_taxa) {
      params.taxon_id = Array.isArray(include_taxa) ? include_taxa.join(",") : include_taxa;
    }
    if (exclude_taxa) {
      params.without_taxon_id = Array.isArray(exclude_taxa) ? exclude_taxa.join(",") : exclude_taxa;
    }
  }

  if (lat && lng && radius) Object.assign(params, { lat, lng, radius });
  if (d1) params.d1 = d1;
  if (d2) params.d2 = d2;

  try {
    const obsResponse = await fetchJSON("https://api.inaturalist.org/v1/observations", params);
    const results = Array.isArray(obsResponse.results) ? obsResponse.results : [];

    if (results.length === 0) {
      throw new Error("Aucune observation trouvée avec vos critères. Essayez d'élargir votre recherche.");
    }

    const shuffledObs = results
      .filter((obs) => obs.taxon && Array.isArray(obs.photos) && obs.photos.length > 0 && obs.taxon.ancestor_ids)
      .sort(() => 0.5 - Math.random());

    if (shuffledObs.length < 4) {
      throw new Error("Pas assez d'espèces différentes trouvées pour créer un quiz.");
    }

    const [targetObservation, ...candidateObs] = shuffledObs;
    const targetAncestorSet = new Set(targetObservation.taxon.ancestor_ids || []);

    const scoredCandidates = candidateObs
      .filter((obs) => obs.taxon && obs.taxon.id !== targetObservation.taxon.id)
      .map((obs) => {
        const score = (obs.taxon.ancestor_ids || []).filter((id) => targetAncestorSet.has(id)).length;
        return { obs, score };
      })
      .sort((a, b) => b.score - a.score);

    const lureObservations = [];
    const seenTaxonIds = new Set([targetObservation.taxon.id]);

    for (const { obs } of scoredCandidates) {
      if (!seenTaxonIds.has(obs.taxon.id)) {
        lureObservations.push(obs);
        seenTaxonIds.add(obs.taxon.id);
      }
      if (lureObservations.length >= 3) break;
    }

    if (lureObservations.length < 3) {
      throw new Error("Pas assez d'espèces différentes trouvées pour créer un quiz.");
    }

    const allTaxonIds = [targetObservation.taxon.id, ...lureObservations.map((o) => o.taxon.id)];
    const allTaxaDetails = await getFullTaxaDetails(allTaxonIds, locale);
    const detailsMap = new Map(allTaxaDetails.map((t) => [t.id, t]));
    const correctTaxonDetails = detailsMap.get(targetObservation.taxon.id);

    if (!correctTaxonDetails) {
      throw new Error(`Impossible de récupérer les détails du taxon (ID: ${targetObservation.taxon.id})`);
    }

    const finalChoices = [
      getTaxonName(correctTaxonDetails),
      ...lureObservations.map((obs) => {
        const d = detailsMap.get(obs.taxon.id);
        return getTaxonName(d);
      }),
    ].sort(() => Math.random() - 0.5);

    const questionQuiz = {
      image_urls: (targetObservation.photos || []).map((p) => p.url.replace("square", "large")),
      bonne_reponse: {
        id: correctTaxonDetails.id,
        name: correctTaxonDetails.name,
        common_name: getTaxonName(correctTaxonDetails),
        ancestors: correctTaxonDetails.ancestors,
        wikipedia_url: correctTaxonDetails.wikipedia_url,
      },
      choix_mode_facile: finalChoices,
      inaturalist_url: targetObservation.uri,
    };

    res.json(questionQuiz);
  } catch (error) {
    console.error("Erreur dans /api/quiz-question:", error.message);
    res.status(500).json({ error: "Erreur interne du serveur: " + error.message });
  }
});

// Autocomplete taxons
app.get("/api/taxa/autocomplete", async (req, res) => {
  const { q, rank, locale = "fr" } = req.query;
  if (!q || q.length < 2) {
    res.json([]);
    return;
  }

  try {
    const params = { q, is_active: true, per_page: 10, locale };
    if (rank) params.rank = rank;

    const response = await fetchJSON("https://api.inaturalist.org/v1/taxa/autocomplete", params);
    const initialSuggestions = Array.isArray(response.results) ? response.results : [];

    if (initialSuggestions.length === 0) {
      res.json([]);
      return;
    }

    const taxonIds = initialSuggestions.map((t) => t.id);
    const taxaDetails = await getFullTaxaDetails(taxonIds, locale);
    const detailsMap = new Map(taxaDetails.map((t) => [t.id, t]));

    const suggestionsWithAncestors = initialSuggestions.map((taxon) => {
      const details = detailsMap.get(taxon.id);
      return {
        id: taxon.id,
        name: taxon.preferred_common_name
          ? `${taxon.preferred_common_name} (${taxon.name})`
          : taxon.name,
        rank: taxon.rank,
        ancestor_ids: details && Array.isArray(details.ancestors)
          ? details.ancestors.map((a) => a.id)
          : [],
      };
    });

    res.json(suggestionsWithAncestors);
  } catch (error) {
    console.error("Erreur dans /api/taxa/autocomplete:", error.message);
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

    if (!result) {
      res.status(404).json({ error: "Taxon non trouvé." });
      return;
    }

    res.json(result);
  } catch (error) {
    res.status(404).json({ error: "Taxon non trouvé." });
  }
});

// Batch de taxons
app.get("/api/taxa", async (req, res) => {
  const { ids, locale = "fr" } = req.query;

  if (!ids) {
    res.status(400).json({ error: "Le paramètre 'ids' est requis." });
    return;
  }

  const taxonIds = ids
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    const taxaDetails = await getFullTaxaDetails(taxonIds, locale);
    res.json(taxaDetails);
  } catch (error) {
    console.error("Erreur dans /api/taxa:", error.message);
    res.status(500).json({ error: "Erreur lors de la récupération des taxons." });
  }
});

/* -------------------- Démarrage -------------------- */
app.listen(PORT, () => {
  console.log(`Serveur Inaturamouche démarré sur le port ${PORT}`);
});
