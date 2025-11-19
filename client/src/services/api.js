// src/services/api.js

// Base URL : garde ta logique actuelle (VITE_API_URL en priorité, sinon dev/prod par défaut)
const runtimeEnv = typeof import.meta !== "undefined" ? import.meta.env || {} : {};

const API_BASE_URL =
  runtimeEnv.VITE_API_URL ||
  (runtimeEnv.DEV
    ? "http://localhost:3001"
    : "https://inaturamouche.onrender.com");

const DEFAULT_TIMEOUT = 8000;

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

async function apiGet(path, params = {}, options = {}) {
  const { signal, timeout = DEFAULT_TIMEOUT } = options;
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
      const error = new Error(data.error || "Erreur réseau");
      error.status = res.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
    if (signal && !signal.aborted) {
      signal.removeEventListener("abort", abortHandler);
    }
  }
}

/**
 * Récupère une question de quiz en fonction des filtres.
 * Accepte objets ou URLSearchParams. Les arrays deviennent "a,b,c".
 */
export const fetchQuizQuestion = (params, options) => apiGet("/api/quiz-question", params, options);

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
