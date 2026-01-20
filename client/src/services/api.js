/// <reference path="../../../types/inaturalist.d.ts" />
// src/services/api.js
import { notify } from "./notifications.js";
import fr from '../locales/fr.js';
import en from '../locales/en.js';
import nl from '../locales/nl.js';
const MESSAGES = { fr, en, nl };
const LANGUAGE_STORAGE_KEY = 'inaturamouche_lang';
const CLIENT_SESSION_ID_KEY = 'inaturamouche_client_session_id';

/**
 * Génère ou récupère un ID de session client unique et persistant.
 * Utilisé pour identifier le client de manière unique au serveur,
 * permettant la reprise de parties.
 */
function getClientSessionId() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'anon-' + Math.random().toString(36).slice(2, 8);
  }
  
  let sessionId = localStorage.getItem(CLIENT_SESSION_ID_KEY);
  if (!sessionId) {
    // Générer un nouvel ID: timestamp + 8 caractères aléatoires
    sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(CLIENT_SESSION_ID_KEY, sessionId);
    console.log('[API] Generated new client session ID:', sessionId);
  }
  return sessionId;
}

function getCurrentLanguage() {
  if (typeof window === 'undefined') return 'fr';
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored && MESSAGES[stored] ? stored : 'fr';
}

// Base URL : garde ta logique actuelle (VITE_API_URL en priorité, sinon dev/prod par défaut)
const runtimeEnv = typeof import.meta !== "undefined" ? import.meta.env || {} : {};

const API_BASE_URL =
  runtimeEnv.VITE_API_URL ||
  (runtimeEnv.DEV
    ? "http://localhost:3001"
    : "https://inaturamouche-api.onrender.com");

// Timeout augmenté à 15s pour absorber les cold starts d'iNaturalist
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_ERROR_MESSAGE = "Une erreur est survenue.";

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff in ms
const RETRYABLE_ERRORS = ['Failed to fetch', 'NetworkError', 'Timeout', 'AbortError'];

const inatFetcher =
  typeof window !== "undefined" && typeof window.fetch === "function"
    ? window.fetch.bind(window)
    : typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
      ? globalThis.fetch.bind(globalThis)
      : null;

export const notifyApiError = (error, fallbackMessage = DEFAULT_ERROR_MESSAGE) => {
  if (!error || typeof window === "undefined") return;
  if (error.name === "AbortError") return;

  // If API provided a structured error with code, try to translate it client-side
  const lang = getCurrentLanguage();
  let message = fallbackMessage;
  if (error && error.code && MESSAGES[lang]?.errors) {
    // Map server codes to keys in locale files
    const codeToKey = {
      INTERNAL_SERVER_ERROR: 'internal',
      BAD_REQUEST: 'bad_request',
      NOT_FOUND: 'not_found',
      POOL_UNAVAILABLE: 'pool_unavailable',
      TAXON_NOT_FOUND: 'taxonomy_not_found',
    };
    const key = codeToKey[error.code];
    if (key && MESSAGES[lang].errors && MESSAGES[lang].errors[key]) {
      message = MESSAGES[lang].errors[key];
    } else if (error.message) {
      message = error.message;
    }
  } else {
    const rawMessage = error.message || "";
    message = rawMessage && !rawMessage.includes("Failed to fetch") ? rawMessage : fallbackMessage;
  }

  notify(message, { type: "error" });
  error.notified = true;
};

/** Construit des URLSearchParams à partir d'un objet.
 *  - Ignore undefined/null/""
 *  - Les arrays sont joints par des virgules (ex: ["1","2"] -> "1,2")
 */
export function buildSearchParams(params = {}) {
  if (params instanceof URLSearchParams) return params;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      const joined = v.map(x => String(x).trim()).filter(Boolean).join(",");
      if (joined) sp.set(k, joined);
    } else {
      sp.set(k, String(v));
    }
  }
  return sp;
}

/**
 * Check if an error is retryable (network issues, timeouts)
 */
function isRetryableError(error) {
  if (!error) return false;
  const message = error.message || '';
  const name = error.name || '';
  
  // Don't retry 4xx errors (client errors)
  if (error.status >= 400 && error.status < 500) return false;
  
  // Retry network errors, timeouts, and 5xx errors
  return RETRYABLE_ERRORS.some(retryable => 
    message.includes(retryable) || name.includes(retryable)
  ) || (error.status >= 500);
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiGet(path, params = {}, options = {}) {
  const { signal, timeout = DEFAULT_TIMEOUT, maxRetries = MAX_RETRIES } = options;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const url = new URL(path, API_BASE_URL);
    url.search = buildSearchParams(params).toString();

    const controller = new AbortController();
    const abortHandler = () => controller.abort(signal?.reason);
    const timeoutId = setTimeout(() => controller.abort(new DOMException("Timeout", "AbortError")), timeout);
    if (signal) {
      if (signal.aborted) {
        controller.abort(signal.reason);
      } else {
        signal.addEventListener("abort", abortHandler, { once: true });
      }
    }

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        // Pas de JSON → laisser data = {}
      }
      if (!res.ok) {
        const apiError = data && data.error ? data.error : null;
        const message = (apiError && apiError.message) || (typeof apiError === 'string' ? apiError : 'Network error');
        const error = new Error(message);
        error.status = res.status;
        if (apiError && apiError.code) error.code = apiError.code;
        error.raw = apiError;
        
        // Check if we should retry
        if (attempt < maxRetries && isRetryableError(error)) {
          // Use exponential backoff: attempt is always 0-2 for maxRetries=3
          const delayIndex = Math.min(attempt, RETRY_DELAYS.length - 1);
          await sleep(RETRY_DELAYS[delayIndex]);
          continue; // Retry
        }
        
        if (!options?.silent) {
          notifyApiError(error);
        }
        throw error;
      }
      return data;
    } catch (error) {
      // Check if we should retry
      if (attempt < maxRetries && isRetryableError(error)) {
        // Use exponential backoff: attempt is always 0-2 for maxRetries=3
        const delayIndex = Math.min(attempt, RETRY_DELAYS.length - 1);
        await sleep(RETRY_DELAYS[delayIndex]);
        continue; // Retry
      }
      
      if (!options?.silent && !error?.notified) notifyApiError(error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal && !signal.aborted) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  }
}

async function apiPost(path, body = {}, options = {}) {
  const { signal, timeout = DEFAULT_TIMEOUT, maxRetries = MAX_RETRIES } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const url = new URL(path, API_BASE_URL);

    const controller = new AbortController();
    const abortHandler = () => controller.abort(signal?.reason);
    const timeoutId = setTimeout(() => controller.abort(new DOMException("Timeout", "AbortError")), timeout);
    if (signal) {
      if (signal.aborted) {
        controller.abort(signal.reason);
      } else {
        signal.addEventListener("abort", abortHandler, { once: true });
      }
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        // Pas de JSON → laisser data = {}
      }
      if (!res.ok) {
        const apiError = data?.error ? data.error : null;
        const message = (apiError?.message) || (typeof apiError === 'string' ? apiError : 'Network error');
        const error = new Error(message);
        error.status = res.status;
        if (apiError?.code) error.code = apiError.code;
        error.raw = apiError;

        if (attempt < maxRetries && isRetryableError(error)) {
          const delayIndex = Math.min(attempt, RETRY_DELAYS.length - 1);
          await sleep(RETRY_DELAYS[delayIndex]);
          continue;
        }
        
        if (!options?.silent) notifyApiError(error);
        throw error;
      }
      return data;
    } catch (error) {
      if (attempt < maxRetries && isRetryableError(error)) {
        const delayIndex = Math.min(attempt, RETRY_DELAYS.length - 1);
        await sleep(RETRY_DELAYS[delayIndex]);
        continue;
      }
      
      if (!options?.silent && !error?.notified) notifyApiError(error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal && !signal.aborted) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  }
}

/**
 * Récupère une question de quiz en fonction des filtres.
 * Accepte objets ou URLSearchParams. Les arrays deviennent "a,b,c".
 * Ajoute automatiquement le clientSessionId pour la persistance de session.
 */
export const fetchQuizQuestion = (params, options) => {
  // Créer une copie des params et ajouter le clientSessionId
  const paramsWithSession = new URLSearchParams(
    typeof params === 'string' ? params : new URLSearchParams(params)
  );
  paramsWithSession.set('client_session_id', getClientSessionId());
  return apiGet("/api/quiz-question", paramsWithSession, options);
};

/**
 * Récupère l'explication IA pour une réponse incorrecte.
 */
export const fetchExplanation = (correctId, wrongId, locale = 'fr') => {
    return apiPost('/api/quiz/explain', { correctId, wrongId, locale }, { timeout: 20000 }); // Timeout plus long pour l'IA
};

/**
 * Détails complets pour un taxon.
 */
export const getTaxonDetails = (id, locale = "fr") =>
  apiGet(`/api/taxon/${id}`, { locale });

/**
 * Autocomplétion des taxons (même API que chez toi).
 */
export const autocompleteTaxa = (query, extraParams = {}, locale = "fr") => {
  const params = { q: query, locale, ...extraParams };
  return apiGet("/api/taxa/autocomplete", params);
};

/**
 * Autocomplétion des lieux (place_id).
 */
export const autocompletePlaces = (query, perPage = 15) =>
  apiGet("/api/places", { q: query, per_page: perPage });

/**
 * Hydrate plusieurs lieux par IDs : utile pour afficher les chips
 * après rechargement (ex: "6744,7034" -> noms & types).
 */
export const getPlacesByIds = (ids = []) => {
  const list = Array.isArray(ids)
    ? ids
    : String(ids).split(",").map(s => s.trim());
  const idsParam = list.filter(Boolean).join(",");
  if (!idsParam) return Promise.resolve([]);
  return apiGet("/api/places/by-id", { ids: idsParam });
};

/**
 * Détails pour plusieurs taxons, en un seul call.
 */
export const getTaxaByIds = (ids, locale = "fr") => {
  if (!ids || ids.length === 0) return Promise.resolve([]);
  const list = Array.isArray(ids) ? ids : String(ids).split(",");
  return apiGet("/api/taxa", { ids: list.join(","), locale });
};

export const getPackCatalog = () => apiGet("/api/packs");

export const fetchSimilarSpecies = async (taxonId) => {
  if (!taxonId || !inatFetcher) return [];
  const url = new URL("https://api.inaturalist.org/v1/identifications/similar_species");
  url.searchParams.set("taxon_id", taxonId);

  try {
    const response = await inatFetcher(url.toString(), {
      headers: { Accept: "application/json" },
    });
    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      // ignore parsing errors
    }

    if (!response.ok) {
      const error = new Error(data?.error || "Impossible de charger les espèces similaires.");
      notifyApiError(error, "Impossible de charger les espèces similaires.");
      throw error;
    }

    const results = Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.similar_species)
        ? data.similar_species
        : [];
    return results;
  } catch (error) {
    if (!error?.notified) {
      notifyApiError(error, "Impossible de charger les espèces similaires.");
    }
    throw error;
  }
};
