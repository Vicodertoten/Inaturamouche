// server.js
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
import PACKS from './shared/packs.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

/* -------------------- CORS (en premier) -------------------- */
const allowedOrigins = [
  'http://localhost:5173',
  'https://inaturamouche.netlify.app',
  'https://inaturaquizz.netlify.app',
];

const corsOptions = {
  origin(origin, cb) {
    // Autorise aussi les requêtes sans Origin (ex: curl, CRON)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed by CORS'));
  },
  credentials: true, // Mets false si tu n’utilises ni cookies ni Authorization côté navigateur
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
};

app.use(cors(corsOptions));
// Preflight pour TOUTES les routes (Express 5 + path-to-regexp v8 compatible)
app.options('/:path*', cors(corsOptions));

// Pour le cache côté proxy/CDN
app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

/* -------------------- Sécurité & perfs -------------------- */
// Désactive CORP pour éviter des blocages sur des ressources cross-origin (API JSON)
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());

// Parser JSON si un jour tu ajoutes des POST/PUT
app.use(express.json());

/* -------------------- Cache HTTP générique -------------------- */
app.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  next();
});

/* -------------------- Utils -------------------- */
async function fetchJSON(url, params = {}) {
  const urlObj = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      urlObj.searchParams.append(key, value);
    }
  });
  const response = await fetch(urlObj);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function getFullTaxaDetails(taxonIds, locale = 'fr') {
  if (!taxonIds || taxonIds.length === 0) return [];

  try {
    // 1) Données localisées
    const localizedResponse = await fetchJSON(
      `https://api.inaturalist.org/v1/taxa/${taxonIds.join(',')}`,
      { locale }
    );
    const localizedResults = localizedResponse.results ?? [];

    // 2) Si locale ≠ en, compléter les champs manquants via la version par défaut
    if (!locale.startsWith('en') && localizedResults.length > 0) {
      const defaultResponse = await fetchJSON(
        `https://api.inaturalist.org/v1/taxa/${taxonIds.join(',')}`
      );
      const defaultResults = defaultResponse.results ?? [];
      const defaultDetailsMap = new Map(defaultResults.map(t => [t.id, t]));

      const finalResults = localizedResults.map(localizedTaxon => {
        const defaultTaxon = defaultDetailsMap.get(localizedTaxon.id);
        if (!localizedTaxon.wikipedia_url && defaultTaxon?.wikipedia_url) {
          localizedTaxon.wikipedia_url = defaultTaxon.wikipedia_url;
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

/* -------------------- Routes -------------------- */

// Santé/monitoring
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

// Génération d’une question de quiz
app.get('/api/quiz-question', async (req, res) => {
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
    locale = 'fr',
  } = req.query;

  const params = {
    quality_grade: 'research',
    photos: true,
    rank: 'species',
    per_page: 200,
    locale,
  };

  if (pack_id) {
    const selectedPack = PACKS.find(p => p.id === pack_id);
    if (selectedPack?.api_params) {
      Object.assign(params, selectedPack.api_params);
    }
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
    const obsResponse = await fetchJSON('https://api.inaturalist.org/v1/observations', params);

    const results = obsResponse.results ?? [];
    if (results.length === 0) {
      throw new Error("Aucune observation trouvée avec vos critères. Essayez d'élargir votre recherche.");
    }

    const shuffledObs = results
      .filter(obs => obs.taxon && obs.photos?.length > 0 && obs.taxon.ancestor_ids)
      .sort(() => 0.5 - Math.random());

    if (shuffledObs.length < 4) {
      throw new Error('Pas assez d’espèces différentes trouvées pour créer un quiz.');
    }

    const [targetObservation, ...candidateObs] = shuffledObs;
    const targetAncestorSet = new Set(targetObservation.taxon.ancestor_ids || []);

    const scoredCandidates = candidateObs
      .filter(obs => obs.taxon && obs.taxon.id !== targetObservation.taxon.id)
      .map(obs => ({
        obs,
        score: (obs.taxon.ancestor_ids || []).filter(id => targetAncestorSet.has(id)).length,
      }))
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
      throw new Error('Pas assez d’espèces différentes trouvées pour créer un quiz.');
    }

    const allTaxonIds = [targetObservation.taxon.id, ...lureObservations.map(o => o.taxon.id)];
    const allTaxaDetails = await getFullTaxaDetails(allTaxonIds, locale);
    const detailsMap = new Map(allTaxaDetails.map(t => [t.id, t]));
    const correctTaxonDetails = detailsMap.get(targetObservation.taxon.id);

    if (!correctTaxonDetails) {
      throw new Error(`Impossible de récupérer les détails du taxon (ID: ${targetObservation.taxon.id})`);
    }

    const finalChoices = [
      getTaxonName(correctTaxonDetails),
      ...lureObservations.map(obs => getTaxonName(detailsMap.get(obs.taxon.id))),
    ].sort(() => Math.random() - 0.5);

    const questionQuiz = {
      image_urls: (targetObservation.photos || []).map(p => p.url.replace('square', 'large')),
      bonne_reponse: {
        id: correctTaxonDetails.id,
        name: correctTaxonDetails.name,
        common_name: getTaxonName(correctTaxonDetails),
        ancestors: correctTaxonDetails.ancestors, // peut être undefined selon l’API
        wikipedia_url: correctTaxonDetails.wikipedia_url,
      },
      choix_mode_facile: finalChoices,
      inaturalist_url: targetObservation.uri,
    };

    res.json(questionQuiz);
  } catch (error) {
    console.error('Erreur dans /api/quiz-question:', error.message);
    res.status(500).json({ error: 'Erreur interne du serveur: ' + error.message });
  }
}
