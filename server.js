const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// La définition des packs est dupliquée ici pour que le serveur soit autonome.
// Dans une application plus grande, ce fichier pourrait être partagé.
const PACKS_CONFIG = [
    { id: 'world_birds', api_params: { taxon_id: '3', popular: 'true' } },
    { id: 'france_mammals', api_params: { taxon_id: '40151', place_id: '6753' } },
    { id: 'belgium_herps', api_params: { taxon_id: '26036,20978', place_id: '6911' }},
    { id: 'amazing_insects', api_params: { taxon_id: '47158', popular: 'true' }},
    { id: 'mediterranean_flora', api_params: { taxon_id: '47126', place_id: '53832' }},
    { id: 'great_barrier_reef_life', api_params: { taxon_id: '1', place_id: '131021' }}
];

const allowedOrigins = [
  'https://inaturamouche.netlify.app', // Votre frontend en production
  'http://localhost:5173'              // Votre frontend en développement local
];
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

// --- FONCTIONS UTILITAIRES ---
async function getFullTaxaDetails(taxonIds, locale) {
    if (!taxonIds || taxonIds.length === 0) return [];
    try {
        const response = await axios.get(`https://api.inaturalist.org/v1/taxa/${taxonIds.join(',')}`, { params: { locale } });
        return response.data.results;
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
        const selectedPack = PACKS_CONFIG.find(p => p.id === pack_id);
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
        const obsResponse = await axios.get('https://api.inaturalist.org/v1/observations', { params });
        
        if (!obsResponse.data.results || obsResponse.data.results.length === 0) {
            throw new Error("Aucune observation trouvée avec vos critères. Essayez d'élargir votre recherche.");
        }
        
        const shuffledObs = obsResponse.data.results.filter(obs => obs.taxon && obs.photos.length > 0).sort(() => 0.5 - Math.random());
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
    console.error("Erreur dans /api/taxa/autocomplete:", error.message);
    res.status(500).json({ error: "Erreur lors de la recherche." });
  }
});


app.get('/api/taxon/:id', async (req, res) => {
  const { id } = req.params;
  const { locale = 'fr' } = req.query;
  try {
    const response = await axios.get(`https://api.inaturalist.org/v1/taxa/${id}`, { params: { locale } });
    res.json(response.data.results[0]);
  } catch (error) {
    res.status(404).json({ error: "Taxon non trouvé." });
  }
});


// --- Lancement du Serveur ---
app.listen(PORT, () => {
    console.log(`Serveur Inaturamouche démarré sur http://localhost:${PORT}`);
});
