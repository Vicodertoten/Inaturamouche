import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
import PACKS from './shared/packs.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Sécurisation et optimisation des réponses HTTP
app.use(helmet());
app.use(compression());

// Les packs sont maintenant partagés avec le client.

const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [];
const corsOptions = {
  origin: function (origin, callback) {
    // Permet les requêtes sans origine (ex: Postman, apps mobiles) ou si l'origine est dans la liste blanche
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
};
app.use(cors(corsOptions));

// Gestion du cache pour toutes les réponses
app.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  next();
});

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
        // 1. Premier appel pour obtenir les données localisées (surtout le nom commun en français)
        const localizedResponse = await fetchJSON(`https://api.inaturalist.org/v1/taxa/${taxonIds.join(',')}`, { locale });
        const localizedResults = localizedResponse.results;

        // Si la locale demandée n'est pas l'anglais, on fait un second appel pour les données manquantes
        if (!locale.startsWith('en') && localizedResults.length > 0) {
            
            // 2. Second appel SANS locale pour obtenir les données par défaut (qui incluent l'URL wiki de manière fiable)
            const defaultResponse = await fetchJSON(`https://api.inaturalist.org/v1/taxa/${taxonIds.join(',')}`);
            const defaultResults = defaultResponse.results;
            
            // On crée une Map pour retrouver facilement les données par défaut par leur ID
            const defaultDetailsMap = new Map(defaultResults.map(t => [t.id, t]));

            // 3. On fusionne les résultats
            const finalResults = localizedResults.map(localizedTaxon => {
                const defaultTaxon = defaultDetailsMap.get(localizedTaxon.id);

                // Si l'URL wiki est manquante dans la version FR, on la prend dans la version par défaut
                if (!localizedTaxon.wikipedia_url && defaultTaxon && defaultTaxon.wikipedia_url) {
                    localizedTaxon.wikipedia_url = defaultTaxon.wikipedia_url;
                }
                return localizedTaxon;
            });

            return finalResults;
        }

        // Si la locale est 'en', le premier appel suffit
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


// --- ROUTES DE L'API ---

app.get('/api/quiz-question', async (req, res) => {
    const { pack_id, taxon_ids, include_taxa, exclude_taxa, lat, lng, radius, d1, d2, locale = 'fr' } = req.query;

    const params = {
        quality_grade: 'research',
        photos: true,
        rank: 'species',
        per_page: 200,
        locale: locale
    };

    if (pack_id) {
        const selectedPack = PACKS.find(p => p.id === pack_id);
        if (selectedPack && selectedPack.api_params) {
            Object.assign(params, selectedPack.api_params);
        }
    }
    else if (taxon_ids) {
        params.taxon_id = Array.isArray(taxon_ids) ? taxon_ids.join(',') : taxon_ids;
    } 
    else if (include_taxa || exclude_taxa) {
        if(include_taxa) params.taxon_id = Array.isArray(include_taxa) ? include_taxa.join(',') : include_taxa;
        if(exclude_taxa) params.without_taxon_id = Array.isArray(exclude_taxa) ? exclude_taxa.join(',') : exclude_taxa;
    }

    if (lat && lng && radius) Object.assign(params, { lat, lng, radius });
    if (d1) params.d1 = d1;
    if (d2) params.d2 = d2;

    try {
        const obsResponse = await fetchJSON('https://api.inaturalist.org/v1/observations', params);

        if (!obsResponse.results || obsResponse.results.length === 0) {
            throw new Error("Aucune observation trouvée avec vos critères. Essayez d'élargir votre recherche.");
        }

        const shuffledObs = obsResponse.results.filter(obs => obs.taxon && obs.photos.length > 0).sort(() => 0.5 - Math.random());
        let uniqueTaxonObservations = [], seenTaxonIds = new Set();
        for (const obs of shuffledObs) {
            if (!seenTaxonIds.has(obs.taxon.id)) {
                uniqueTaxonObservations.push(obs);
                seenTaxonIds.add(obs.taxon.id);
            }
            if (uniqueTaxonObservations.length >= 4) break;
        }
        
        if (uniqueTaxonObservations.length < 4) throw new Error("Pas assez d'espèces différentes trouvées pour créer un quiz.");

        const [targetObservation, ...lureObservations] = uniqueTaxonObservations;
        const allTaxonIds = [targetObservation.taxon.id, ...lureObservations.map(obs => obs.taxon.id)];
        
        const allTaxaDetails = await getFullTaxaDetails(allTaxonIds, locale);
        const detailsMap = new Map(allTaxaDetails.map(t => [t.id, t]));
        const correctTaxonDetails = detailsMap.get(targetObservation.taxon.id);

        if (!correctTaxonDetails) {
            throw new Error(`Impossible de récupérer les détails du taxon (ID: ${targetObservation.taxon.id})`);
        }
        const finalChoices = [getTaxonName(correctTaxonDetails), ...lureObservations.map(obs => getTaxonName(detailsMap.get(obs.taxon.id)))];
        const questionQuiz = {
            image_urls: targetObservation.photos.map(p => p.url.replace('square', 'large')),
            bonne_reponse: { 
                id: correctTaxonDetails.id, 
                name: correctTaxonDetails.name, 
                common_name: getTaxonName(correctTaxonDetails), 
                ancestors: correctTaxonDetails.ancestors,
                wikipedia_url: correctTaxonDetails.wikipedia_url
            },
            choix_mode_facile: finalChoices.sort(() => Math.random() - 0.5),
            inaturalist_url: targetObservation.uri
        };
        res.json(questionQuiz);

    } catch (error) {
        console.error("Erreur dans /api/quiz-question:", error.message);
        res.status(500).json({ error: "Erreur interne du serveur: " + error.message });
    }
});


app.get('/api/taxa/autocomplete', async (req, res) => {
  const { q, rank, locale = 'fr' } = req.query;
  if (!q || q.length < 2) return res.json([]);
  
  try {
    const params = { q, is_active: true, per_page: 10, locale };
    if (rank) params.rank = rank;
    
    const response = await fetchJSON('https://api.inaturalist.org/v1/taxa/autocomplete', params);
    const initialSuggestions = response.results;
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
    console.error("Erreur dans /api/taxa/autocomplete:", error.message);
    res.status(500).json({ error: "Erreur lors de la recherche." });
  }
});


app.get('/api/taxon/:id', async (req, res) => {
  const { id } = req.params;
  const { locale = 'fr' } = req.query;
  try {
    const response = await fetchJSON(`https://api.inaturalist.org/v1/taxa/${id}`, { locale });
    res.json(response.results[0]);
  } catch (error) {
    res.status(404).json({ error: "Taxon non trouvé." });
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
    console.error("Erreur dans /api/taxa:", error.message);
    res.status(500).json({ error: "Erreur lors de la récupération des taxons." });
  }
});


// --- Lancement du Serveur ---
app.listen(PORT, () => {
    console.log(`Serveur Inaturamouche démarré sur http://localhost:${PORT}`);
});
