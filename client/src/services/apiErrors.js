/**
 * Lightweight error message registry for api.js
 * Avoids importing the full locale files (~2200 lines) just for ~10 error translations.
 */

const API_ERRORS = {
  fr: {
    internal: 'Erreur interne du serveur',
    bad_request: 'Paramètres invalides',
    not_found: 'Introuvable',
    pool_unavailable: 'Aucune observation trouvée pour ces critères. Veuillez élargir la zone géographique, la période, ou réessayer plus tard.',
    taxonomy_not_found: 'Taxon non trouvé.',
    generic: 'Une erreur est survenue. Réessayez plus tard.',
    rate_limited: 'Trop de requêtes. Veuillez patienter.',
  },
  en: {
    internal: 'Internal server error',
    bad_request: 'Bad request',
    not_found: 'Not Found',
    pool_unavailable: 'No observations found for these criteria. Please broaden the geographic area, time period, or try again later.',
    taxonomy_not_found: 'Taxon not found.',
    generic: 'Something went wrong. Please try again later.',
    rate_limited: 'Too many requests. Please wait.',
  },
  nl: {
    internal: 'Interne serverfout',
    bad_request: 'Ongeldige parameters',
    not_found: 'Niet gevonden',
    pool_unavailable: 'Geen waarnemingen gevonden voor deze criteria. Verbreed het geografisch gebied, de periode, of probeer later opnieuw.',
    taxonomy_not_found: 'Taxon niet gevonden.',
    generic: 'Er ging iets mis. Probeer het later opnieuw.',
    rate_limited: 'Te veel verzoeken. Even geduld.',
  },
};

/**
 * Map server error codes to error message keys.
 */
export const CODE_TO_KEY = {
  INTERNAL_SERVER_ERROR: 'internal',
  BAD_REQUEST: 'bad_request',
  NOT_FOUND: 'not_found',
  POOL_UNAVAILABLE: 'pool_unavailable',
  TAXON_NOT_FOUND: 'taxonomy_not_found',
  ROUND_EXPIRED: 'generic',
  INVALID_ROUND_SIGNATURE: 'generic',
  EXPLAIN_RATE_LIMIT_EXCEEDED: 'rate_limited',
  EXPLAIN_DAILY_QUOTA_EXCEEDED: 'rate_limited',
  REPORT_RATE_LIMIT_EXCEEDED: 'rate_limited',
};

/**
 * Get the translated error message for a given language and error key.
 * @param {string} lang - Language code ('fr', 'en', 'nl')
 * @param {string} key - Error key from CODE_TO_KEY
 * @returns {string|null}
 */
export function getApiErrorMessage(lang, key) {
  return API_ERRORS[lang]?.[key] ?? null;
}

/**
 * Check if a language is supported in the API error registry.
 * @param {string} lang
 * @returns {boolean}
 */
export function isApiLanguageSupported(lang) {
  return lang in API_ERRORS;
}
