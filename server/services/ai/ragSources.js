// server/services/ai/ragSources.js
// Pipeline de données v6 — envoyer TOUTES les données à l'IA
// Philosophie : l'IA fait le tri et la traduction, pas nos regex.

import { DATA_SOURCES } from './aiConfig.js';

// ── Helpers ─────────────────────────────────────────────────────

const createTimeoutSignal = (ms) => {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

const safeFetch = async (url, { timeoutMs = 5_000, logger } = {}) => {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'iNaturaQuizz/2.0 (nature quiz app)' },
      signal: createTimeoutSignal(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    logger?.debug?.({ url, error: err.message }, 'Data source fetch failed');
    return null;
  }
};

const truncate = (text, maxLen) => {
  if (!text) return '';
  const normalized = String(text).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  // Couper au dernier espace avant la limite
  const cut = normalized.lastIndexOf(' ', maxLen);
  return normalized.slice(0, cut > maxLen * 0.7 ? cut : maxLen).trim();
};

const getCommonName = (taxon) =>
  taxon?.preferred_common_name || taxon?.common_name || null;

const getAncestorName = (taxon, rank) => {
  if (!taxon) return null;
  if (taxon.rank === rank) return taxon.name;
  return Array.isArray(taxon.ancestors)
    ? taxon.ancestors.find((a) => a?.rank === rank)?.name || null
    : null;
};

// ── Wikipedia REST API ──────────────────────────────────────────

/**
 * Récupère les résumés Wikipedia EN + locale pour un taxon.
 * v6 : on retourne TOUTES les descriptions trouvées, pas juste la "meilleure".
 * L'IA fera la synthèse et la traduction.
 */
async function fetchWikipediaSummaries(taxon, locale = 'fr', { logger } = {}) {
  if (!DATA_SOURCES.wikipedia.enabled) return [];

  const scientificName = taxon?.name;
  if (!scientificName) return [];

  const { apiUrl, maxSummaryLength, timeoutMs } = DATA_SOURCES.wikipedia;
  const commonName = getCommonName(taxon);
  const enCommonName = taxon?.english_common_name || taxon?.preferred_common_name;

  const fetches = [];

  // EN — nom scientifique
  fetches.push(
    safeFetch(apiUrl('en', scientificName), { timeoutMs, logger })
      .then((json) => json?.type === 'standard' && json.extract ? { lang: 'en', extract: json.extract } : null)
  );

  // EN — nom commun anglais
  if (enCommonName && enCommonName !== scientificName) {
    fetches.push(
      safeFetch(apiUrl('en', enCommonName), { timeoutMs, logger })
        .then((json) => json?.type === 'standard' && json.extract ? { lang: 'en', extract: json.extract } : null)
    );
  }

  // Locale — nom scientifique et nom commun
  if (locale !== 'en') {
    fetches.push(
      safeFetch(apiUrl(locale, scientificName), { timeoutMs, logger })
        .then((json) => json?.type === 'standard' && json.extract ? { lang: locale, extract: json.extract } : null)
    );
    if (commonName && commonName !== scientificName) {
      fetches.push(
        safeFetch(apiUrl(locale, commonName), { timeoutMs, logger })
          .then((json) => json?.type === 'standard' && json.extract ? { lang: locale, extract: json.extract } : null)
      );
    }
  }

  const results = (await Promise.allSettled(fetches))
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);

  if (results.length === 0) return [];

  // Dédupliquer (même texte via nom scientifique et commun)
  const seen = new Set();
  const unique = [];
  for (const r of results) {
    const key = r.extract.slice(0, 80);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({
        lang: r.lang,
        summary: truncate(r.extract, maxSummaryLength),
      });
    }
  }

  return unique;
}

// ── iNaturalist ─────────────────────────────────────────────────

function extractInatDescription(taxon) {
  if (!DATA_SOURCES.inaturalist.enabled) return null;

  const rawSummary = taxon?.wikipedia_summary
    || taxon?.wikipedia_description
    || taxon?.description
    || '';

  const summary = truncate(rawSummary, DATA_SOURCES.inaturalist.maxDescLength);
  if (!summary || summary.length < 20) return null;
  if (/^(espèce|species)$/i.test(summary.trim())) return null;

  return summary;
}

// ── Collecteur principal ────────────────────────────────────────

/**
 * Collecte TOUTES les données disponibles pour un taxon.
 * v6 : retourne les descriptions EN + locale séparément.
 * L'IA recevra tout et fera la synthèse.
 */
export async function collectSpeciesData(taxon, locale = 'fr', { logger } = {}) {
  if (!taxon) return { descriptions: [], sources: [], taxonomy: {}, contextText: '' };

  const taxonomy = {
    scientific: taxon.name || null,
    common: getCommonName(taxon),
    rank: taxon.rank || null,
    family: getAncestorName(taxon, 'family'),
    genus: getAncestorName(taxon, 'genus'),
    order: getAncestorName(taxon, 'order'),
    iconic_taxon_name: taxon.iconic_taxon_name || null,
  };

  const [wikiResults, inatResult] = await Promise.all([
    fetchWikipediaSummaries(taxon, locale, { logger }).catch((err) => {
      logger?.warn?.({ error: err.message }, 'Wikipedia fetch failed');
      return [];
    }),
    Promise.resolve(extractInatDescription(taxon)),
  ]);

  const sources = [];
  const descriptions = [];

  // Toutes les descriptions Wikipedia, tagguées par langue
  for (const wiki of wikiResults) {
    const langLabel = wiki.lang === locale ? '' : ` (${wiki.lang})`;
    sources.push(`Wikipedia${langLabel}`);
    descriptions.push({ lang: wiki.lang, text: wiki.summary, source: 'wikipedia' });
  }

  // iNat en complément
  if (inatResult) {
    const isDuplicate = descriptions.some((d) =>
      d.text.includes(inatResult.slice(0, 50)) || inatResult.includes(d.text.slice(0, 50))
    );
    if (!isDuplicate) {
      sources.push('iNaturalist');
      descriptions.push({ lang: 'unknown', text: inatResult, source: 'inaturalist' });
    }
  }

  // Construire le contexte textuel pour le prompt IA
  // v6 : on envoie TOUT, l'IA fera le tri
  const contextParts = [];
  const label = taxonomy.common
    ? `${taxonomy.common} (${taxonomy.scientific})`
    : taxonomy.scientific;
  if (label) contextParts.push(`Espèce : ${label}`);
  if (taxonomy.family) contextParts.push(`Famille : ${taxonomy.family}`);

  if (descriptions.length > 0) {
    for (const desc of descriptions) {
      const langTag = desc.lang === locale ? '' : `[${desc.lang.toUpperCase()}] `;
      contextParts.push(`${langTag}${desc.text}`);
    }
  } else {
    contextParts.push('Aucune description disponible.');
  }

  // Aussi retourner la meilleure description seule (pour compat)
  const bestDesc = descriptions.find((d) => d.lang === locale)?.text
    || descriptions.find((d) => d.lang === 'en')?.text
    || descriptions[0]?.text
    || '';

  logger?.info?.(
    { taxonId: taxon.id, sources, descCount: descriptions.length, totalLen: descriptions.reduce((s, d) => s + d.text.length, 0) },
    'Species data collected'
  );

  return {
    descriptions,
    description: bestDesc,
    sources,
    taxonomy,
    contextText: contextParts.join('\n'),
  };
}
