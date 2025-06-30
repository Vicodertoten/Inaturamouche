// src/services/api.js

import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

/**
 * Récupère une question de quiz en fonction des paramètres de filtres.
 * @param {URLSearchParams} params - Les paramètres de la requête.
 * @returns {Promise<Object>} La question du quiz.
 */
export const fetchQuizQuestion = async (params) => {
  try {
    const response = await apiClient.get('/api/quiz-question', { params });
    return response.data;
  } catch (error) {
    // Propage l'erreur pour que le composant puisse la gérer
    throw new Error(error.response?.data?.error || "Impossible de charger la question.");
  }
};

/**
 * Récupère les détails complets pour un seul taxon.
 * @param {string|number} id - L'ID du taxon.
 * @param {string} locale - La langue souhaitée.
 * @returns {Promise<Object>} Les détails du taxon.
 */
export const getTaxonDetails = async (id, locale = 'fr') => {
  try {
    const response = await apiClient.get(`/api/taxon/${id}`, { params: { locale } });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || "Taxon non trouvé.");
  }
};

/**
 * Récupère une liste de suggestions pour l'autocomplétion.
 * @param {string} query - Le terme de recherche.
 * @param {Object} extraParams - Paramètres supplémentaires (ex: { rank: 'species' }).
 * @param {string} locale - La langue souhaitée.
 * @returns {Promise<Array>} Une liste de suggestions.
 */
export const autocompleteTaxa = async (query, extraParams = {}, locale = 'fr') => {
    const params = { q: query, locale, ...extraParams };
    try {
        const response = await apiClient.get('/api/taxa/autocomplete', { params });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.error || "Erreur de recherche.");
    }
};

/**
 * NOUVEAU: Récupère les détails pour plusieurs taxons en un seul appel.
 * @param {Array<string|number>} ids - Un tableau d'IDs de taxons.
 * @param {string} locale - La langue souhaitée.
 * @returns {Promise<Array>} Un tableau de détails de taxons.
 */
export const getTaxaByIds = async (ids, locale = 'fr') => {
  if (!ids || ids.length === 0) return [];
  try {
    // L'endpoint attend des IDs séparés par des virgules
    const response = await apiClient.get(`/api/taxa?ids=${ids.join(',')}`, { params: { locale } });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || "Taxons non trouvés.");
  }
};