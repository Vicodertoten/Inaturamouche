/// <reference path="../../../types/inaturalist.d.ts" />
// src/services/api.js
import { notify } from "./notifications.js";
import { getApiErrorMessage, isApiLanguageSupported, CODE_TO_KEY } from './apiErrors.js';
import { debugWarn } from '../utils/logger.js';
const LANGUAGE_STORAGE_KEY = 'inaturamouche_lang';
const CLIENT_SESSION_ID_KEY = 'inaturamouche_client_session_id';

const getLocalStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (error) {
    debugWarn('Access to localStorage is blocked', error);
    return null;
  }
};

/**
 * Génère ou récupère un ID de session client unique et persistant.
 * Utilisé pour identifier le client de manière unique au serveur,
 * permettant la reprise de parties.
 */
function getClientSessionId() {
  const storage = getLocalStorage();
  if (!storage) {
    return 'anon-' + Math.random().toString(36).slice(2, 8);
  }
  
  let sessionId = storage.getItem(CLIENT_SESSION_ID_KEY);
  if (!sessionId) {
    // Générer un nouvel ID: timestamp + 8 caractères aléatoires
    sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    storage.setItem(CLIENT_SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

function getCurrentLanguage() {
  if (typeof window === 'undefined') return 'fr';
  const storage = getLocalStorage();
  const stored = storage?.getItem(LANGUAGE_STORAGE_KEY);
  return stored && isApiLanguageSupported(stored) ? stored : 'fr';
}

// Base URL : garde ta logique actuelle (VITE_API_URL en priorité, sinon dev/prod par défaut)
const runtimeEnv = typeof import.meta !== "undefined" ? import.meta.env || {} : {};

export const API_BASE_URL =
  runtimeEnv.VITE_API_URL ||
  (runtimeEnv.DEV
    ? ""
    : "https://inaturamouche-api.fly.dev");

/**
 * Build a full URL from a path + optional base.
 * When API_BASE_URL is empty (dev proxy), use window.location.origin.
 */
function buildApiUrl(path) {
  const base = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
  return new URL(path, base);
}

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
  if (error && error.code) {
    const key = CODE_TO_KEY[error.code];
    const translated = key ? getApiErrorMessage(lang, key) : null;
    if (translated) {
      message = translated;
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
    const url = buildApiUrl(path);
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
    const url = buildApiUrl(path);

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
 * Soumet une réponse pour validation serveur.
 * La bonne réponse n'est jamais exposée avant cet appel.
 */
export const submitQuizAnswer = (
  {
    roundId,
    roundSignature,
    selectedTaxonId,
    submissionId,
    roundAction,
    stepIndex,
    seedSession,
  },
  options
) => {
  const payload = {
    round_id: roundId,
    round_signature: roundSignature,
    submission_id: submissionId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    client_session_id: getClientSessionId(),
  };
  if (seedSession) {
    payload.seed_session = seedSession;
  }
  if (selectedTaxonId !== undefined && selectedTaxonId !== null) {
    payload.selected_taxon_id = selectedTaxonId;
  }
  if (roundAction) {
    payload.round_action = roundAction;
  }
  if (Number.isInteger(stepIndex)) {
    payload.step_index = stepIndex;
  }

  return apiPost(
    '/api/quiz/submit',
    payload,
    options
  );
};

/**
 * Récupère l'explication IA pour une réponse incorrecte.
 */
export const fetchExplanation = (correctId, wrongId, locale = 'fr', focusRank = null) => {
    return apiPost(
      '/api/quiz/explain',
      { correctId, wrongId, locale, focusRank },
      { timeout: 20000 }
    ); // Timeout plus long pour l'IA
};

export const submitBugReport = ({
  description,
  url = typeof window !== 'undefined' ? window.location.href : '',
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  website = '',
}) =>
  apiPost(
    '/api/reports',
    { description, url, userAgent, website },
    {
      timeout: 10000,
      maxRetries: 1,
    }
  );

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
