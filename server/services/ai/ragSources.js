// server/services/ai/ragSources.js
// Collecte des preuves pour les explications IA.

import { SmartCache } from '../../../lib/smart-cache.js';
import { CACHE_VERSIONS, DATA_SOURCES } from './aiConfig.js';

const taxonEvidenceCache = new SmartCache({
  max: 4000,
  ttl: 1000 * 60 * 60 * 24,
  staleTtl: 1000 * 60 * 60 * 24 * 7,
});

const taxonomySupportCache = new SmartCache({
  max: 4000,
  ttl: 1000 * 60 * 60 * 24 * 7,
  staleTtl: 1000 * 60 * 60 * 24 * 30,
});

const createTimeoutSignal = (ms) => {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

const safeFetchJson = async (url, { timeoutMs = 5_000, logger } = {}) => {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'iNaturaQuizz/2.0 (nature quiz app)' },
      signal: createTimeoutSignal(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    logger?.debug?.({ url, error: err.message }, 'Evidence source fetch failed');
    return null;
  }
};

const truncate = (text, maxLen) => {
  if (!text) return '';
  const normalized = String(text).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  const cut = normalized.lastIndexOf(' ', maxLen);
  return normalized.slice(0, cut > maxLen * 0.7 ? cut : maxLen).trim();
};

const normalizeSnippetKey = (text) =>
  truncate(text, 240)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const getCommonName = (taxon) =>
  taxon?.preferred_common_name || taxon?.common_name || null;

const getAncestorName = (taxon, rank) => {
  if (!taxon) return null;
  if (taxon.rank === rank) return taxon.name;
  return Array.isArray(taxon.ancestors)
    ? taxon.ancestors.find((a) => a?.rank === rank)?.name || null
    : null;
};

const toLabel = (taxon) => {
  const scientific = taxon?.name || null;
  const common = getCommonName(taxon);
  return common ? `${common} (${scientific})` : scientific || 'Espèce inconnue';
};

const buildSourceRecord = ({
  id,
  provider,
  kind,
  label,
  url,
  lang = 'unknown',
  license = null,
  snippet = '',
}) => ({
  id,
  provider,
  kind,
  label,
  url,
  lang,
  license,
  snippet: truncate(snippet, 320),
});

const FACT_CATEGORY_KEYWORDS = {
  habitat: [
    'habitat', 'milieu', 'forêt', 'foret', 'marais', 'rivière', 'riviere', 'étang', 'etang',
    'prairie', 'bois', 'shore', 'wetland', 'forest', 'woods', 'river', 'lake', 'pond', 'coast',
    'habitat', 'bos', 'rivier', 'meer', 'vijver', 'kust', 'grasland',
  ],
  behavior: [
    'vole', 'vol', 'nage', 'niche', 'chante', 'migre', 'flight', 'flying', 'song', 'call',
    'feeds', 'feeding', 'swims', 'behavior', 'behaviour', 'broedt', 'zingt', 'vliegt', 'zwemt',
  ],
};

function detectDescriptionCategory(text) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return 'description';
  if (FACT_CATEGORY_KEYWORDS.behavior.some((keyword) => normalized.includes(keyword))) {
    return 'behavior';
  }
  if (FACT_CATEGORY_KEYWORDS.habitat.some((keyword) => normalized.includes(keyword))) {
    return 'habitat';
  }
  return 'description';
}

function splitIntoFacts(text, maxFacts = 2) {
  const normalized = truncate(text, 260);
  if (!normalized) return [];
  const segments = normalized
    .split(/(?<=[.!?])\s+|;\s+/u)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 24);
  if (segments.length === 0) {
    return [normalized];
  }
  return segments.slice(0, maxFacts);
}

function buildFactsFromSource(source, { taxonId } = {}) {
  if (!source?.snippet) return [];
  const rawFacts =
    source.kind === 'description'
      ? splitIntoFacts(source.snippet, 2)
      : [truncate(source.snippet, 180)];

  return rawFacts
    .map((text, index) => ({
      id: `${source.id}:f${index + 1}`,
      sourceId: source.id,
      provider: source.provider,
      kind: source.kind,
      category:
        source.kind === 'description'
          ? detectDescriptionCategory(text)
          : source.kind,
      taxonId: taxonId || null,
      text: truncate(text, 180),
    }))
    .filter((fact) => fact.text);
}

async function fetchWikipediaSummaries(taxon, locale = 'fr', { logger } = {}) {
  if (!DATA_SOURCES.wikipedia.enabled) return [];

  const scientificName = taxon?.name;
  if (!scientificName) return [];

  const { apiUrl, maxSummaryLength, timeoutMs } = DATA_SOURCES.wikipedia;
  const commonName = getCommonName(taxon);
  const enCommonName = taxon?.english_common_name || taxon?.preferred_common_name;
  const fetches = [];

  const buildSummaryResult = (lang, requestedTitle) => (json) =>
    json?.type === 'standard' && json.extract
      ? {
          lang,
          extract: json.extract,
          title: json.title || requestedTitle,
          requestedTitle,
        }
      : null;

  fetches.push(
    safeFetchJson(apiUrl('en', scientificName), { timeoutMs, logger })
      .then(buildSummaryResult('en', scientificName))
  );

  if (enCommonName && enCommonName !== scientificName) {
    fetches.push(
      safeFetchJson(apiUrl('en', enCommonName), { timeoutMs, logger })
        .then(buildSummaryResult('en', enCommonName))
    );
  }

  if (locale !== 'en') {
    fetches.push(
      safeFetchJson(apiUrl(locale, scientificName), { timeoutMs, logger })
        .then(buildSummaryResult(locale, scientificName))
    );
    if (commonName && commonName !== scientificName) {
      fetches.push(
        safeFetchJson(apiUrl(locale, commonName), { timeoutMs, logger })
          .then(buildSummaryResult(locale, commonName))
      );
    }
  }

  const results = (await Promise.allSettled(fetches))
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);

  const seen = new Set();
  return results.filter((item) => {
    const normalized = truncate(item.extract, maxSummaryLength);
    const key = `${item.lang}:${normalized.slice(0, 80)}`;
    if (!normalized || seen.has(key)) return false;
    seen.add(key);
    item.extract = normalized;
    return true;
  });
}

function extractInatDescription(taxon) {
  if (!DATA_SOURCES.inaturalist.enabled) return '';
  const rawSummary = taxon?.wikipedia_summary || taxon?.wikipedia_description || taxon?.description || '';
  const summary = truncate(rawSummary, DATA_SOURCES.inaturalist.maxDescLength);
  if (!summary || summary.length < 20) return '';
  if (/^(espèce|species)$/i.test(summary.trim())) return '';
  return {
    text: summary,
    origin:
      taxon?.wikipedia_summary || taxon?.wikipedia_description
        ? 'wikipedia_mirror'
        : 'inaturalist',
    url:
      taxon?.wikipedia_summary || taxon?.wikipedia_description
        ? taxon?.wikipedia_url || null
        : taxon?.url || `https://www.inaturalist.org/taxa/${taxon.id}`,
  };
}

async function fetchGbifMatch(taxon, { logger } = {}) {
  if (!DATA_SOURCES.gbif.enabled || !taxon?.name) return null;
  const cacheKey = `${CACHE_VERSIONS.taxonomySupport}:gbif:${taxon.name}`;
  return taxonomySupportCache.getOrFetch(
    cacheKey,
    async () => {
      const data = await safeFetchJson(DATA_SOURCES.gbif.apiUrl(taxon.name), {
        timeoutMs: DATA_SOURCES.gbif.timeoutMs,
        logger,
      });
      if (!data || (!data.usageKey && !data.matchType)) return null;
      return data;
    },
    { allowStale: true, background: true }
  );
}

function buildCatalogueOfLifeSupport(taxon) {
  if (!DATA_SOURCES.catalogueOfLife.enabled || !taxon?.name) return null;
  return {
    acceptedName: taxon.name,
    searchUrl: DATA_SOURCES.catalogueOfLife.searchUrl(taxon.name),
    snippet: `Vérifier le nom accepté et les synonymes pour ${taxon.name}.`,
  };
}

function buildTaxonomySummary(taxon, gbifMatch) {
  const parts = [];
  const family = getAncestorName(taxon, 'family');
  const genus = getAncestorName(taxon, 'genus');
  if (family) parts.push(`Famille ${family}`);
  if (genus) parts.push(`genre ${genus}`);
  if (taxon?.rank) parts.push(`rang ${taxon.rank}`);
  if (gbifMatch?.status) parts.push(`GBIF ${String(gbifMatch.status).toLowerCase()}`);
  return parts.join(', ');
}

function buildClaim(text, sourceId) {
  if (!text || !sourceId) return null;
  return {
    text: truncate(text, 180),
    sourceId,
  };
}

function buildPromptText(evidence) {
  const lines = [];
  lines.push(`Espèce: ${evidence.label}`);
  if (evidence.taxonomy.family) lines.push(`Famille: ${evidence.taxonomy.family}`);
  if (evidence.taxonomy.genus) lines.push(`Genre: ${evidence.taxonomy.genus}`);
  evidence.facts.all.slice(0, 8).forEach((fact) => {
    lines.push(`[${fact.category}] ${fact.text}`);
  });
  return lines.join('\n');
}

export async function collectTaxonEvidence(taxon, locale = 'fr', { logger } = {}) {
  if (!taxon?.id) {
    return {
      label: 'Espèce inconnue',
      taxonomy: {},
      descriptionSources: [],
      taxonomySources: [],
      distributionSources: [],
      allSources: [],
      claims: { descriptionBacked: [], taxonomyBacked: [], distributionBacked: [] },
      promptText: '',
    };
  }

  const cacheKey = `${CACHE_VERSIONS.taxonEvidence}:${taxon.id}:${locale}`;
  return taxonEvidenceCache.getOrFetch(
    cacheKey,
    async () => {
      const label = toLabel(taxon);
      const taxonomy = {
        scientific: taxon.name || null,
        common: getCommonName(taxon),
        rank: taxon.rank || null,
        family: getAncestorName(taxon, 'family'),
        genus: getAncestorName(taxon, 'genus'),
        order: getAncestorName(taxon, 'order'),
        iconic_taxon_name: taxon.iconic_taxon_name || null,
      };

      const [wikiSummaries, gbifMatch] = await Promise.all([
        fetchWikipediaSummaries(taxon, locale, { logger }),
        fetchGbifMatch(taxon, { logger }),
      ]);

      const descriptionSources = [];
      const taxonomySources = [];
      const distributionSources = [];
      const seenDescriptionSnippets = new Set();

      taxonomySources.push(
        buildSourceRecord({
          id: `inat-tax-${taxon.id}`,
          provider: 'inaturalist',
          kind: 'taxonomy',
          label: `${label} — iNaturalist`,
          url: taxon?.url || `https://www.inaturalist.org/taxa/${taxon.id}`,
          lang: locale,
          snippet: buildTaxonomySummary(taxon),
        })
      );

      wikiSummaries.forEach((entry, index) => {
        const snippetKey = normalizeSnippetKey(entry.extract);
        if (!snippetKey || seenDescriptionSnippets.has(snippetKey)) return;
        seenDescriptionSnippets.add(snippetKey);
        descriptionSources.push(
          buildSourceRecord({
            id: `wiki-desc-${taxon.id}-${index + 1}`,
            provider: 'wikimedia',
            kind: 'description',
            label: `${label} — Wikipedia (${entry.lang})`,
            url: `https://${entry.lang}.wikipedia.org/wiki/${encodeURIComponent(entry.title || taxon.name)}`,
            lang: entry.lang,
            snippet: entry.extract,
          })
        );
      });

      const inatDescription = extractInatDescription(taxon);
      if (inatDescription?.text) {
        const snippetKey = normalizeSnippetKey(inatDescription.text);
        if (snippetKey && !seenDescriptionSnippets.has(snippetKey)) {
          seenDescriptionSnippets.add(snippetKey);
          const isWikipediaMirror = inatDescription.origin === 'wikipedia_mirror';
          descriptionSources.push(
            buildSourceRecord({
              id: `inat-desc-${taxon.id}`,
              provider: isWikipediaMirror ? 'wikimedia' : 'inaturalist',
              kind: 'description',
              label: isWikipediaMirror
                ? `${label} — Wikipedia via iNaturalist`
                : `${label} — iNaturalist`,
              url: inatDescription.url || taxon?.url || `https://www.inaturalist.org/taxa/${taxon.id}`,
              lang: locale,
              snippet: inatDescription.text,
            })
          );
        }
      }

      const colSupport = buildCatalogueOfLifeSupport(taxon);
      if (colSupport) {
        taxonomySources.push(
          buildSourceRecord({
            id: `col-tax-${taxon.id}`,
            provider: 'col',
            kind: 'taxonomy',
            label: `${label} — Catalogue of Life`,
            url: colSupport.searchUrl,
            lang: 'unknown',
            license: 'CC BY 4.0',
            snippet: colSupport.snippet,
          })
        );
        taxonomySources.push(
          buildSourceRecord({
            id: `col-syn-${taxon.id}`,
            provider: 'col',
            kind: 'synonymy',
            label: `${label} — Catalogue of Life`,
            url: colSupport.searchUrl,
            lang: 'unknown',
            license: 'CC BY 4.0',
            snippet: `Contrôler les synonymes et la hiérarchie taxonomique de ${taxon.name}.`,
          })
        );
      }

      if (gbifMatch) {
        const gbifUrl = gbifMatch.usageKey
          ? `https://www.gbif.org/species/${gbifMatch.usageKey}`
          : `https://www.gbif.org/species/search?q=${encodeURIComponent(taxon.name)}`;
        taxonomySources.push(
          buildSourceRecord({
            id: `gbif-tax-${taxon.id}`,
            provider: 'gbif',
            kind: 'taxonomy',
            label: `${label} — GBIF`,
            url: gbifUrl,
            lang: 'unknown',
            snippet: truncate(
              [
                gbifMatch.matchType ? `Match ${gbifMatch.matchType}` : null,
                gbifMatch.status ? `statut ${String(gbifMatch.status).toLowerCase()}` : null,
                gbifMatch.family ? `famille ${gbifMatch.family}` : null,
                gbifMatch.genus ? `genre ${gbifMatch.genus}` : null,
              ]
                .filter(Boolean)
                .join(', '),
              220
            ),
          })
        );
        if (typeof gbifMatch.note === 'string' && gbifMatch.note.trim()) {
          distributionSources.push(
            buildSourceRecord({
              id: `gbif-dist-${taxon.id}`,
              provider: 'gbif',
              kind: 'distribution',
              label: `${label} — GBIF`,
              url: gbifUrl,
              lang: 'unknown',
              snippet: gbifMatch.note,
            })
          );
        }
      }

      const allSources = [...descriptionSources, ...taxonomySources, ...distributionSources];
      const facts = {
        description: descriptionSources.flatMap((source) => buildFactsFromSource(source, { taxonId: taxon.id })),
        taxonomy: taxonomySources.flatMap((source) => buildFactsFromSource(source, { taxonId: taxon.id })),
        distribution: distributionSources.flatMap((source) => buildFactsFromSource(source, { taxonId: taxon.id })),
      };
      facts.synonymy = facts.taxonomy.filter((fact) => fact.kind === 'synonymy');
      facts.behavior = facts.description.filter((fact) => fact.category === 'behavior');
      facts.habitat = facts.description.filter((fact) => fact.category === 'habitat');
      facts.visual = facts.description.filter((fact) => fact.category === 'description');
      facts.all = [
        ...facts.visual,
        ...facts.behavior,
        ...facts.habitat,
        ...facts.taxonomy,
        ...facts.distribution,
      ];
      const claims = {
        descriptionBacked: descriptionSources
          .map((source) => buildClaim(source.snippet, source.id))
          .filter(Boolean),
        taxonomyBacked: taxonomySources
          .map((source) => buildClaim(source.snippet, source.id))
          .filter(Boolean),
        distributionBacked: distributionSources
          .map((source) => buildClaim(source.snippet, source.id))
          .filter(Boolean),
      };
      const promptFacts = {
        description: [...facts.visual, ...facts.behavior, ...facts.habitat].slice(0, 5),
        taxonomy: facts.taxonomy.slice(0, 2),
        distribution: facts.distribution.slice(0, 2),
      };

      const evidence = {
        taxonId: taxon.id,
        label,
        taxonomy,
        descriptionSources,
        taxonomySources,
        distributionSources,
        allSources,
        facts,
        claims,
        promptFacts,
      };
      evidence.promptText = buildPromptText(evidence);
      return evidence;
    },
    { allowStale: true, background: true }
  );
}

function buildContrastText(correctEvidence, wrongEvidence) {
  const lines = [];
  if (correctEvidence?.taxonomy?.family && wrongEvidence?.taxonomy?.family) {
    if (correctEvidence.taxonomy.family === wrongEvidence.taxonomy.family) {
      lines.push(`Les deux especes sont dans la meme famille: ${correctEvidence.taxonomy.family}.`);
    } else {
      lines.push(
        `${correctEvidence.label} appartient a ${correctEvidence.taxonomy.family}, ` +
          `${wrongEvidence.label} a ${wrongEvidence.taxonomy.family}.`
      );
    }
  }
  const firstCorrectDescription = correctEvidence?.descriptionSources?.[0]?.snippet;
  const firstWrongDescription = wrongEvidence?.descriptionSources?.[0]?.snippet;
  if (firstCorrectDescription) {
    lines.push(`[${correctEvidence.descriptionSources[0].id}] ${firstCorrectDescription}`);
  }
  if (firstWrongDescription) {
    lines.push(`[${wrongEvidence.descriptionSources[0].id}] ${firstWrongDescription}`);
  }
  return lines.join('\n');
}

function buildContrastFacts(correctEvidence, wrongEvidence) {
  const facts = [];
  if (correctEvidence?.taxonomy?.family && wrongEvidence?.taxonomy?.family) {
    if (correctEvidence.taxonomy.family === wrongEvidence.taxonomy.family) {
      facts.push({
        id: `contrast-family-${correctEvidence.taxonId}-${wrongEvidence.taxonId}`,
        sourceId: correctEvidence.taxonomySources?.[0]?.id || wrongEvidence.taxonomySources?.[0]?.id || null,
        provider: 'server',
        kind: 'taxonomy',
        category: 'taxonomy',
        taxonId: correctEvidence.taxonId,
        text: `Les deux especes sont dans la meme famille: ${correctEvidence.taxonomy.family}.`,
      });
    } else {
      facts.push({
        id: `contrast-family-${correctEvidence.taxonId}-${wrongEvidence.taxonId}`,
        sourceId: correctEvidence.taxonomySources?.[0]?.id || wrongEvidence.taxonomySources?.[0]?.id || null,
        provider: 'server',
        kind: 'taxonomy',
        category: 'taxonomy',
        taxonId: correctEvidence.taxonId,
        text: `${correctEvidence.label} appartient a ${correctEvidence.taxonomy.family}, ${wrongEvidence.label} a ${wrongEvidence.taxonomy.family}.`,
      });
    }
  }
  const firstCorrectFact = correctEvidence?.promptFacts?.description?.[0];
  const firstWrongFact = wrongEvidence?.promptFacts?.description?.[0];
  if (firstCorrectFact) {
    facts.push({
      id: `contrast-correct-${firstCorrectFact.id}`,
      sourceId: firstCorrectFact.sourceId,
      provider: firstCorrectFact.provider,
      kind: firstCorrectFact.kind,
      category: firstCorrectFact.category,
      taxonId: firstCorrectFact.taxonId,
      text: `${correctEvidence.label}: ${firstCorrectFact.text}`,
    });
  }
  if (firstWrongFact) {
    facts.push({
      id: `contrast-wrong-${firstWrongFact.id}`,
      sourceId: firstWrongFact.sourceId,
      provider: firstWrongFact.provider,
      kind: firstWrongFact.kind,
      category: firstWrongFact.category,
      taxonId: firstWrongFact.taxonId,
      text: `${wrongEvidence.label}: ${firstWrongFact.text}`,
    });
  }
  return facts.slice(0, 3);
}

function buildSourceCatalogText(sources) {
  const rows = ['Catalogues de preuves disponibles:'];
  sources.forEach((source) => {
    rows.push(`- ${source.id} | ${source.provider}/${source.kind} | ${source.snippet}`);
  });
  return rows.join('\n');
}

export async function collectEvidenceBundle(correctTaxon, wrongTaxon, locale = 'fr', { logger } = {}) {
  const [correct, wrong] = await Promise.all([
    collectTaxonEvidence(correctTaxon, locale, { logger }),
    collectTaxonEvidence(wrongTaxon, locale, { logger }),
  ]);
  const sources = [...(correct?.allSources || []), ...(wrong?.allSources || [])];
  const contrastFacts = buildContrastFacts(correct, wrong);

  return {
    locale,
    correct,
    wrong,
    sources,
    facts: [...(correct?.facts?.all || []), ...(wrong?.facts?.all || [])],
    contrastFacts,
    sourceCatalogText: buildSourceCatalogText(sources),
    contrastText: buildContrastText(correct, wrong),
  };
}

export async function collectSpeciesData(taxon, locale = 'fr', { logger } = {}) {
  const evidence = await collectTaxonEvidence(taxon, locale, { logger });
  const descriptions = evidence.descriptionSources.map((source) => ({
    lang: source.lang,
    text: source.snippet,
    source: source.provider,
  }));
  return {
    descriptions,
    description: descriptions[0]?.text || '',
    sources: evidence.allSources.map((source) => source.label).slice(0, 4),
    taxonomy: evidence.taxonomy,
    contextText: evidence.promptText,
  };
}
