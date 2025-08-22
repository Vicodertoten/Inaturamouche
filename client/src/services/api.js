// src/services/api.js

const API_BASE_URL =
  import.meta?.env?.VITE_API_URL || 'https://inaturamouche-api.onrender.com';

async function apiGet(path, params = {}) {
  const url = new URL(path, API_BASE_URL);
  const searchParams = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  url.search = searchParams.toString();
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Erreur réseau');
    error.status = res.status;
    throw error;
  }
  return data;
}

/**
 * Récupère une question de quiz en fonction des paramètres de filtres.
 * @param {URLSearchParams|Object} params - Les paramètres de la requête.
 * @returns {Promise<Object>} La question du quiz.
 */
export const fetchQuizQuestion = (params) => apiGet('/api/quiz-question', params);

/**
 * Récupère les détails complets pour un seul taxon.
 * @param {string|number} id - L'ID du taxon.
 * @param {string} locale - La langue souhaitée.
 * @returns {Promise<Object>} Les détails du taxon.
 */
export const getTaxonDetails = (id, locale = 'fr') =>
  apiGet(`/api/taxon/${id}`, { locale });

/**
 * Récupère une liste de suggestions pour l'autocomplétion.
 * @param {string} query - Le terme de recherche.
 * @param {Object} extraParams - Paramètres supplémentaires (ex: { rank: 'species' }).
 * @param {string} locale - La langue souhaitée.
 * @returns {Promise<Array>} Une liste de suggestions.
 */
export const autocompleteTaxa = (query, extraParams = {}, locale = 'fr') => {
  const params = { q: query, locale, ...extraParams };
  return apiGet('/api/taxa/autocomplete', params);
};

/**
 * Récupère les détails pour plusieurs taxons en un seul appel.
 * @param {Array<string|number>} ids - Un tableau d'IDs de taxons.
 * @param {string} locale - La langue souhaitée.
 * @returns {Promise<Array>} Un tableau de détails de taxons.
 */
export const getTaxaByIds = (ids, locale = 'fr') => {
  if (!ids || ids.length === 0) return Promise.resolve([]);
  return apiGet('/api/taxa', { ids: ids.join(','), locale });
};

