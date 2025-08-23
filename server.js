// server.js
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import PACKS from './shared/packs.js';

const app = express();
const PORT = process.env.PORT || 3001;

/* -------------------- CORS (AVANT TOUT) -------------------- */
// Origines autorisées (prod + dev). Ajoute d'autres domaines si besoin.
const allowedOrigins = new Set([
  'https://inaturamouche.netlify.app',
  'https://inaturaquizz.netlify.app',   // <- important pour ton front actuel
  'http://localhost:5173'
]);

// Toujours varier sur l'origine pour éviter les caches piégeux
app.use((req, res, next) => {
  res.setHeader('Vary', 'Origin');
  next();
});

// CORS global (préflights inclus, sans wildcard Express 5)
app.use(
  cors({
    origin(origin, cb) {
      // Autorise les requêtes sans origin (curl, Postman) et les origines whitelistees
      if (!origin || allowedOrigins.has(origin)) return cb(null, true);
      // Refuse calmement (pas d'exception inutile)
      return cb(null, false);
    },
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
    preflightContinue: false,       // le middleware répond tout seul aux OPTIONS
    optionsSuccessStatus: 204
  })
);

/* -------------------- UTILS -------------------- */
async function getFullTaxaDetails(taxonIds, locale = 'fr') {
  if (!taxonIds || taxonIds.length === 0) return [];

  try {
    // 1) Données localisées (nom commun FR)
    const localizedResponse = await axios.get(
      `https://api.inaturalist.org/v1/taxa/${taxonIds.join(',')}`,
      { params: { locale } }
    );
    const localizedResults = localizedResponse.data.results;

    // 2) Si non-EN, récupérer les champs manquants depuis la version par défaut
    if (!locale.startsWith('en') && localizedResults.length > 0) {
      const defaultResponse = await axios.get(
        `https://api.inaturalist.org/v1/taxa/${taxonIds.join(',')}`
      );
      const defaultResults = defaultResponse.data.results;
      const defaultDetailsMap = new Map(defaultResults.map(t => [t.id, t]));

      const finalResults = localizedResults.map(localizedTaxon => {
        const d = defaultDetailsMap.get(localizedTaxon.id);
        if (!localizedTaxon.wikipedia_url && d?.wikipedia_url) {
          localizedTaxon.wikipedia_url = d.wikipedia_url;
        }
        return localizedTaxon;
      });

      return finalResults;
    }

    return localizedResults;
  } catch (error) {
    console.error('Erreur lors de la récupération des détails des taxons:', error.message);
    return [];
  }
}

function getTaxonName(taxon) {
  if (!taxon) return 'Nom introuvable';
  return taxon.preferred_common_name || taxon.name;
}

/* -------------------- DIAG -------------------- */
// Ping simple pour vérifier uptime + CORS
app.get('/healthz', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Version (utile pour savoir quel build tourne)
app.get('/version', (req, res) => {
  res.json({ version: process.env.COMMIT || 'dev' });
});

/* -------------------- ROUTES API -------------------- */

app.get('/api/quiz-question', async (req, res) => {
  const { pack_id, taxon_ids, include_taxa, exclude_taxa, lat, lng, radius, d1, d2, locale = 'fr' } = req.query;

  const params = {
    quality_grade: 'research',
    photos: true,
    rank: 'species',
    per_page: 200,
    locale
  };

  if (pack_id) {
    const selectedPack = PACKS.find(p => p.id === pack_id);
    if (selectedPack?.api_params) Object.assign(params, selectedPack.api_params);
  } else if (taxon_ids) {
    params.taxon_id = Array.isArray(taxon_ids) ? taxon_ids.join(',') : taxon_ids;
  } else if (include_taxa || exclude_taxa) {
    if (include_taxa) params.taxon_id = Array.isArray(include_taxa) ? include_taxa.join(',') : include_taxa;
    if (exclude_taxa) params.without_taxon_id = Array.isArray(exclude_taxa) ? exclude_taxa.join(',') : exclude_taxa;
  }

  if (lat && lng && radius) Object.assign(params, { lat, lng, radius });
  if (d1) params.d1 = d1;
  if (d2) params.d2 = d2;

  try {
    const obsResponse = await axios.get('https://api.inaturalist.org/v1/observations', { params });

    if (!obsResponse.data.results || obsResponse.data.results.length === 0) {
      throw new Error("Aucune observation trouvée avec vos critères. Essayez d'élargir votre recherche.");
    }

    const shuffledObs = obsResponse.data.results
      .filter(obs => obs.taxon && obs.photos.length > 0)
      .sort(() => 0.5 - Math.random());

    const uniqueTaxonObservations = [];
    const seenTaxonIds = new Set();

    for (const obs of shuffledObs) {
      if (!seenTaxonIds.has(obs.taxon.id)) {
        uniqueTaxonObservations.push(obs);
        seenTaxonIds.add(obs.taxon.id);
      }
      if (uniqueTaxonObservations.length >= 4) break;
    }

    if (uniqueTaxonObservations.length < 4) {
      throw new Error("Pas assez d'espèces différentes trouvées pour créer un quiz.");
    }

    const [targetObservation, ...lureObservations] = uniqueTaxonObservations;
    const allTaxonIds = [targetObservation.taxon.id, ...lureObservations.map(obs => obs.taxon.id)];

    const allTaxaDetails = await getFullTaxaDetails(allTaxonIds, locale);
    const detailsMap = new Map(allTaxaDetails.map(t => [t.id, t]));
    const correctTaxonDetails = detailsMap.get(targetObservation.taxon.id);

    if (!correctTaxonDetails) {
      throw new Error(`Impossible de récupérer les détails du taxon (ID: ${targetObservation.taxon.id})`);
    }

    const finalChoices = [
      getTaxonName(correctTaxonDetails),
      ...lureObservations.map(obs => getTaxonName(detailsMap.get(obs.taxon.id)))
    ].sort(() => Math.random() - 0.5);

    const questionQuiz = {
      image_urls: targetObservation.photos.map(p => p.url.replace('square', 'large')),
      bonne_reponse: {
        id: correctTaxonDetails.id,
        name: correctTaxonDetails.name,
        common_name: getTaxonName(correctTaxonDetails),
        ancestors: correctTaxonDetails.ancestors,
        wikipedia_url: correctTaxonDetails.wikipedia_url
      },
      choix_mode_facile: finalChoices,
      inaturalist_url: targetObservation.uri
    };

    res.json(questionQuiz);
  } catch (error) {
    console.error('Erreur dans /api/quiz-question:', error.message);
    res.status(500).json({ error: 'Erreur interne du serveur: ' + error.message });
  }
});

app.get('/api/taxa/autocomplete', async (req, res) => {
  const { q, rank, locale = 'fr' } = req.query;
  if (!q || q.length < 2) return res.json([]);

  try {
    const params = { q, is_active: true, per_page: 10, locale };
    if (rank) params.rank = rank;

    const response = await axios.get('https://api.inaturalist.org/v1/taxa/autocomplete', { params });
    const initialSuggestions = response.data.results;
    if (initialSuggestions.length === 0) return res.json([]);

    const taxonIds = initialSuggestions.map(t => t.id);
    const taxaDetails = await getFullTaxaDetails(taxonIds, locale);
    const detailsMap = new Map(taxaDetails.map(t => [t.id, t]));

    const suggestionsWithAncestors = initialSuggestions.map(taxon => {
      const details = detailsMap.get(taxon.id);
      return {
        id: taxon.id,
        name: taxon.preferred_common_name ? `${taxon.preferred_common_name} (${taxon.name})` : taxon.name,
        rank: taxon.rank,
        ancestor_ids: details ? details.ancestors.map(a => a.id) : []
      };
    });

    res.json(suggestionsWithAncestors);
  } catch (error) {
    console.error('Erreur dans /api/taxa/autocomplete:', error.message);
    res.status(500).json({ error: 'Erreur lors de la recherche.' });
  }
});

app.get('/api/taxon/:id', async (req, res) => {
  const { id } = req.params;
  const { locale = 'fr' } = req.query;
  try {
    const response = await axios.get(`https://api.inaturalist.org/v1/taxa/${id}`, { params: { locale } });
    res.json(response.data.results[0]);
  } catch (error) {
    res.status(404).json({ error: 'Taxon non trouvé.' });
  }
});

app.get('/api/taxa', async (req, res) => {
  const { ids, locale = 'fr' } = req.query;
  if (!ids) {
    return res.status(400).json({ error: "Le paramètre 'ids' est requis." });
  }

  const taxonIds = ids.split(',');
  try {
    const taxaDetails = await getFullTaxaDetails(taxonIds, locale);
    res.json(taxaDetails);
  } catch (error) {
    console.error('Erreur dans /api/taxa:', error.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des taxons.' });
  }
});

/* -------------------- START -------------------- */
app.listen(PORT, () => {
  console.log(`Serveur Inaturamouche démarré sur http://localhost:${PORT}`);
});
