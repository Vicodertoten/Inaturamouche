// server/services/aiService.js
import { config } from '../config/index.js';
import { SmartCache } from '../../lib/smart-cache.js';

const { aiApiKey } = config;
const MODEL = 'gemini-2.5-flash-lite';
const AI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${aiApiKey}`;
const EXPLANATION_CACHE_VERSION = 'mamie-v2';
const RIDDLE_CACHE_VERSION = 'mamie-v1';

const explanationCache = new SmartCache({
  max: 1000,
  ttl: 1000 * 60 * 60 * 24 * 7,
  staleTtl: 1000 * 60 * 60 * 24 * 30,
});

const riddleCache = new SmartCache({
  max: 1000,
  ttl: 1000 * 60 * 60 * 24 * 7,
  staleTtl: 1000 * 60 * 60 * 24 * 30,
});

const MAX_DESC_LENGTH = 500;
const RIDDLE_CLUE_COUNT = 3;
const RIDDLE_MAX_CLUE_LENGTH = 180;
const API_TIMEOUT_MS = 10000;

const createTimeoutSignal = (ms) => {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const truncate = (value, maxLen) => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  return normalized.length > maxLen ? normalized.slice(0, maxLen).trim() : normalized;
};

const getAncestor = (taxon, rank) => {
  if (!taxon) return null;
  if (taxon.rank === rank) return taxon;
  return Array.isArray(taxon.ancestors) ? taxon.ancestors.find((a) => a?.rank === rank) : null;
};

const getAncestorName = (taxon, rank) => getAncestor(taxon, rank)?.name || null;
const getAncestorId = (taxon, rank) => getAncestor(taxon, rank)?.id || null;

const getCommonName = (taxon) => taxon?.preferred_common_name || taxon?.common_name || null;

const getWikiSummary = (taxon) =>
  truncate(
    taxon?.wikipedia_summary ||
      taxon?.wikipedia_description ||
      taxon?.description ||
      taxon?.summary ||
      '',
    MAX_DESC_LENGTH
  );

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripTaxonNames = (text, taxon) => {
  if (!text) return '';
  const names = [taxon?.name, getCommonName(taxon)].filter(Boolean);
  if (names.length === 0) return text;
  let updated = text;
  names.forEach((name) => {
    const re = new RegExp(`\\b${escapeRegExp(String(name))}\\b`, 'gi');
    updated = updated.replace(re, 'cette espece');
  });
  return updated;
};

const sanitizeRiddleClue = (value) => {
  if (!value) return '';
  let clue = normalizeText(value);
  clue = clue.replace(/^(indice|clue)\s*\d+\s*[:.)-]?\s*/i, '');
  clue = clue.replace(/^[-*•]\s+/, '');
  return truncate(clue, RIDDLE_MAX_CLUE_LENGTH);
};

const buildRiddleContextPayload = ({ targetTaxon, locale }) =>
  JSON.stringify({
    locale,
    target: {
      scientific: targetTaxon?.name || null,
      common: getCommonName(targetTaxon),
      family: getAncestorName(targetTaxon, 'family'),
      genus: getAncestorName(targetTaxon, 'genus'),
      rank: targetTaxon?.rank || null,
      description: getWikiSummary(targetTaxon),
    },
  });

const buildRiddleSystemPrompt = ({ locale, strictJson = false }) => `
Tu es Mamie Mouche, grand-mere naturaliste: chaleureuse, drole, tres pedago.
Langue=${locale}. Ton role: creer une enigme en 3 indices, du plus difficile au plus evident.
Ne donne jamais le nom scientifique ni le nom commun de l'espece, ni aucun indice qui contient son nom.
Chaque indice est une phrase courte, precise, sans jargon inutile.
Tu aides lutilisateur a reconnaitre les especes avec des indices clairs et memorables.
Pas de markdown, pas de listes, pas d'emojis.
Tu es experte en biologie, tu n'inventes rien, tu utilises uniquement des informations fiables.
Reponds uniquement en JSON strict, format:
{"clues":["Indice 1","Indice 2","Indice 3"]}
${strictJson ? 'Respecte strictement le format JSON, sans aucun texte autour.' : ''}
`.trim();

const parseRiddleResponse = (text) => {
  if (!text) return [];
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed?.clues)) return parsed.clues;
    } catch (_) {
      // fallthrough
    }
  }
  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length >= 3) return lines;
  return trimmed
    .split(/(?:\.\s+|;\s+|•\s+)/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const normalizeRiddleClues = (clues, targetTaxon) => {
  const names = [targetTaxon?.name, getCommonName(targetTaxon)]
    .filter(Boolean)
    .map((name) => String(name).toLowerCase());
  const cleaned = (Array.isArray(clues) ? clues : [])
    .map((clue) => sanitizeRiddleClue(clue))
    .map((clue) => stripTaxonNames(clue, targetTaxon))
    .filter(Boolean)
    .filter((clue) => {
      const lower = clue.toLowerCase();
      return !names.some((name) => lower.includes(name));
    });
  return cleaned;
};

const buildFallbackRiddleClues = (targetTaxon) => {
  const family = getAncestorName(targetTaxon, 'family');
  const genus = getAncestorName(targetTaxon, 'genus');
  const summary = stripTaxonNames(getWikiSummary(targetTaxon), targetTaxon);
  const firstSentence = summary.split(/[.!?]/).map((s) => s.trim()).filter(Boolean)[0] || '';
  const fallback = [
    family ? `Appartient a la famille ${family}.` : 'Espece sauvage observee dans des habitats naturels.',
    firstSentence || 'Son comportement et son habitat donnent un indice aux naturalistes.',
    genus ? `Le genre est ${genus}.` : 'Un detail morphologique permet de la distinguer a coup sur.',
  ];
  return fallback.map((clue) => sanitizeRiddleClue(clue));
};

const calculateSeverity = (correctTaxon, wrongTaxon) => {
  const sameGenus = getAncestorId(correctTaxon, 'genus') &&
    getAncestorId(correctTaxon, 'genus') === getAncestorId(wrongTaxon, 'genus');
  if (sameGenus) return 'CLOSE';

  const sameFamily = getAncestorId(correctTaxon, 'family') &&
    getAncestorId(correctTaxon, 'family') === getAncestorId(wrongTaxon, 'family');
  if (sameFamily) return 'MEDIUM';

  const kingdomId = getAncestorId(correctTaxon, 'kingdom');
  const wrongKingdomId = getAncestorId(wrongTaxon, 'kingdom');
  if (kingdomId && wrongKingdomId && kingdomId !== wrongKingdomId) return 'HUGE';

  const classId = getAncestorId(correctTaxon, 'class');
  const wrongClassId = getAncestorId(wrongTaxon, 'class');
  if (classId && wrongClassId && classId !== wrongClassId) return 'HUGE';

  const iconicMismatch = correctTaxon?.iconic_taxon_id &&
    wrongTaxon?.iconic_taxon_id &&
    correctTaxon.iconic_taxon_id !== wrongTaxon.iconic_taxon_id;
  if (iconicMismatch) return 'HUGE';

  return 'MEDIUM';
};

const buildSystemPrompt = ({ severity, locale, strictLength = false }) => `
Tu es Mamie Mouche, grand-mere naturaliste: chaleureuse, drole, tres pedago.
Langue=${locale}. Tutoiement. Severity=${severity}.
Reponds en 2 phrases, 24 a 42 mots. Pas de markdown, pas d'emojis, pas de listes, pas de salutations.
Ne dis jamais "image/photo" ni "selon". Ne compare pas par genre/famille/ordre/classe; parle de traits observables.
Appuie-toi sur CONTEXTE_JSON et des connaissances sures; si un detail est incertain, dis-le.
Si severity="HUGE", taquine gentiment. Si severity="MEDIUM", sois stricte et claire. Si severity="CLOSE", encourage et sois experte.
Donne un critere discriminant net pour ne plus confondre.
${strictLength ? 'Fais exactement 2 phrases, 24 a 42 mots.' : ''}
`.trim();

const buildContextPayload = ({ correctTaxon, wrongTaxon, locale, severity }) =>
  JSON.stringify({
    locale,
    severity,
    correct: {
      scientific: correctTaxon?.name || null,
      common: getCommonName(correctTaxon),
    },
    wrong: {
      scientific: wrongTaxon?.name || null,
      common: getCommonName(wrongTaxon),
    },
  });

const buildParts = async ({ correctTaxon, wrongTaxon, locale, severity }) => {
  const contextJson = buildContextPayload({ correctTaxon, wrongTaxon, locale, severity });
  const parts = [{ text: `CONTEXTE_JSON:${contextJson}` }];
  let imagesAttached = 0;

  parts.push({ text: 'Explique la différence de manière claire et mémorable.' });
  return { parts, imagesAttached };
};

const normalizeExplanation = (text) => {
  if (!text) return '';
  let value = text.trim().replace(/\s+/g, ' ');
  value = value.replace(/\bvisible sur (la|l') (premi[eè]re|seconde|deuxi[eè]me) (image|photo)\b/gi, '');
  value = value.replace(/\b(montr[ée]e?|présent[ée]e?) sur (la|l') (premi[eè]re|seconde|deuxi[eè]me) (image|photo)\b/gi, '');
  value = value.replace(/\b(sur|dans) (la|l') (image|photo)\b/gi, '');
  value = value.replace(/\b(premi[eè]re|seconde|deuxi[eè]me) (image|photo)\b/gi, '');
  value = value.replace(/\b(selon|d'apr[eè]s)\s+wikip[ée]dia\b/gi, '');
  value = value.replace(/\bL([A-ZÀ-ÖØ-Ý])([a-zà-öø-ÿ])/g, "L'$1$2");
  value = value.replace(/^L\s+premier\b/i, 'Le premier');
  value = value.replace(/^L\s+second\b/i, 'Le second');
  value = value.replace(/^L\s+seconde\b/i, 'La seconde');
  value = value.replace(/^L\s+premiere\b/i, 'La premiere');
  return value.replace(/\s{2,}/g, ' ').trim();
};

const formatTaxonLabel = (taxon) => {
  const common = getCommonName(taxon);
  const scientific = taxon?.name;
  if (common && scientific) return `${common} (${scientific})`;
  return common || scientific || 'cette espece';
};

const buildSafeFallback = (correctTaxon, wrongTaxon, severity) => {
  const correctLabel = formatTaxonLabel(correctTaxon);
  const wrongLabel = formatTaxonLabel(wrongTaxon);
  const toneLead = severity === 'HUGE' ? 'Oh la la, ' : severity === 'CLOSE' ? 'Tu etais tout pres, ' : '';

  const firstSentence = `${toneLead}${correctLabel} et ${wrongLabel} se ressemblent, mais ce ne sont pas la meme espece.`;
  const secondSentence = 'Astuce de Mamie Mouche: cherche un repere simple (silhouette, bec ou pattes, milieu) avant d\'aller aux details.';
  return `${firstSentence} ${secondSentence}`;
};

const countSentences = (text) => {
  if (!text) return 0;
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : 0;
};

const countWords = (text) => {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const isTooShort = (text) => countSentences(text) < 2 || countWords(text) < 20;
const isTooLong = (text) => countWords(text) > 50;

/**
 * Generates a custom educational explanation using the Gemini API.
 *
 * @param {object} correctTaxon - The full taxon object for the correct answer.
 * @param {object} wrongTaxon - The full taxon object for the user's incorrect answer.
 * @param {string} locale - The locale for the response language (e.g., 'fr', 'en').
 * @param {pino.Logger} logger - The logger instance.
 * @returns {Promise<string>} The AI-generated explanation.
 */
export async function generateCustomExplanation(correctTaxon, wrongTaxon, locale = 'fr', logger) {
  if (!aiApiKey) {
    logger?.warn('AI_API_KEY is not configured. Skipping AI explanation.');
    return 'Mamie Mouche fait une infusion, explication indisponible !';
  }

  if (!correctTaxon || !wrongTaxon) {
    throw new Error('Correct and wrong taxon details are required.');
  }

  const severity = calculateSeverity(correctTaxon, wrongTaxon);
  const cacheKey = `${EXPLANATION_CACHE_VERSION}:${locale}:${correctTaxon.id}-${wrongTaxon.id}`;
  const cacheEntry = explanationCache.getEntry(cacheKey);
  if (cacheEntry) {
    logger?.info(
      { cacheKey, cacheStatus: cacheEntry.isStale ? 'stale' : 'hit' },
      'Gemini explanation cache'
    );
  } else {
    logger?.info({ cacheKey, cacheStatus: 'miss' }, 'Gemini explanation cache');
  }

  try {
    return await explanationCache.getOrFetch(
      cacheKey,
      async () => {
        const { parts, imagesAttached } = await buildParts({ correctTaxon, wrongTaxon, locale, severity });

        const callGemini = async (strictLength = false) => {
          logger?.info(
            {
              imagesAttached,
              hasContextJson: true,
              severity,
              locale,
              strictLength,
            },
            'Gemini request payload'
          );
          const requestBody = {
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.4,
              topP: 0.9,
              maxOutputTokens: 700,
            },
            systemInstruction: {
              parts: [{ text: buildSystemPrompt({ severity, locale, strictLength }) }],
            },
          };

          const response = await fetch(AI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: createTimeoutSignal(API_TIMEOUT_MS),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            logger?.error({ status: response.status, body: errorBody }, 'Gemini API request failed');
            throw new Error(`Gemini API error: ${response.statusText}`);
          }

          const data = await response.json();
          const usage = data?.usageMetadata;
          if (usage) {
            logger?.info(
              {
                promptTokens: usage.promptTokenCount ?? null,
                candidateTokens: usage.candidatesTokenCount ?? null,
                totalTokens: usage.totalTokenCount ?? null,
              },
              'Gemini usage metadata'
            );
          }
          const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!explanation) {
            logger?.warn({ apiResponse: data }, 'Gemini API returned an empty explanation.');
            throw new Error('Empty explanation from AI.');
          }

          return normalizeExplanation(explanation);
        };

        const first = await callGemini(false);
        if (!isTooShort(first) && !isTooLong(first)) return first;

        try {
          const adjusted = await callGemini(true);
          if (!isTooShort(adjusted) && !isTooLong(adjusted)) return adjusted;
          return buildSafeFallback(correctTaxon, wrongTaxon, severity);
        } catch (error) {
          logger?.warn({ error: error.message }, 'Gemini adjustment failed, using first answer');
          return isTooShort(first) || isTooLong(first)
            ? buildSafeFallback(correctTaxon, wrongTaxon, severity)
            : first;
        }
      },
      {
        onError: (err) => logger?.error({ error: err.message }, 'AI explanation cache fetch failed'),
      }
    );
  } catch (error) {
    logger?.error({ error: error.message }, 'Failed to generate explanation from Gemini API.');
    return "Mamie Mouche a un trou de memoire, elle ne peut pas fournir d'explication pour le moment.";
  }
}

/**
 * Generates a 3-clue riddle describing a target species.
 *
 * @param {object} targetTaxon - The full taxon object for the target species.
 * @param {string} locale - The locale for the response language (e.g., 'fr', 'en').
 * @param {pino.Logger} logger - The logger instance.
 * @returns {Promise<{clues: string[], source: string}>} The riddle clues and source.
 */
export async function generateRiddle(targetTaxon, locale = 'fr', logger) {
  if (!targetTaxon) {
    throw new Error('Target taxon details are required.');
  }

  const fallbackClues = buildFallbackRiddleClues(targetTaxon);
  if (!aiApiKey) {
    logger?.warn('AI_API_KEY is not configured. Falling back to static riddle clues.');
    return { clues: fallbackClues, source: 'fallback' };
  }

  const cacheKey = `${RIDDLE_CACHE_VERSION}:${locale}:${targetTaxon.id}`;
  const cacheEntry = riddleCache.getEntry(cacheKey);
  if (cacheEntry) {
    logger?.info(
      { cacheKey, cacheStatus: cacheEntry.isStale ? 'stale' : 'hit' },
      'Gemini riddle cache'
    );
  } else {
    logger?.info({ cacheKey, cacheStatus: 'miss' }, 'Gemini riddle cache');
  }

  const finalizeClues = (clues) => {
    const normalized = normalizeRiddleClues(clues, targetTaxon);
    const needsFallback = normalized.length < RIDDLE_CLUE_COUNT;
    const filled = needsFallback
      ? normalized.concat(fallbackClues).slice(0, RIDDLE_CLUE_COUNT)
      : normalized.slice(0, RIDDLE_CLUE_COUNT);
    return { clues: filled, needsFallback };
  };

  try {
    return await riddleCache.getOrFetch(
      cacheKey,
      async () => {
        const contextJson = buildRiddleContextPayload({ targetTaxon, locale });
        const parts = [
          { text: `CONTEXTE_JSON:${contextJson}` },
          { text: 'Decris cette espece en trois indices, du plus difficile au plus evident.' },
        ];

        const callGemini = async (strictJson = false) => {
          logger?.info({ locale, strictJson }, 'Gemini riddle request payload');
          const requestBody = {
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.6,
              topP: 0.9,
              maxOutputTokens: 700,
            },
            systemInstruction: {
              parts: [{ text: buildRiddleSystemPrompt({ locale, strictJson }) }],
            },
          };

          const response = await fetch(AI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: createTimeoutSignal(API_TIMEOUT_MS),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            logger?.error({ status: response.status, body: errorBody }, 'Gemini riddle request failed');
            throw new Error(`Gemini API error: ${response.statusText}`);
          }

          const data = await response.json();
          const usage = data?.usageMetadata;
          if (usage) {
            logger?.info(
              {
                promptTokens: usage.promptTokenCount ?? null,
                candidateTokens: usage.candidatesTokenCount ?? null,
                totalTokens: usage.totalTokenCount ?? null,
              },
              'Gemini riddle usage metadata'
            );
          }
          const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!responseText) {
            logger?.warn({ apiResponse: data }, 'Gemini API returned an empty riddle.');
            throw new Error('Empty riddle from AI.');
          }
          return parseRiddleResponse(responseText);
        };

        const first = await callGemini(false);
        const firstResult = finalizeClues(first);
        if (!firstResult.needsFallback) {
          return { clues: firstResult.clues, source: 'ai' };
        }

        try {
          const adjusted = await callGemini(true);
          const adjustedResult = finalizeClues(adjusted);
          if (!adjustedResult.needsFallback) {
            return { clues: adjustedResult.clues, source: 'ai' };
          }
          return { clues: adjustedResult.clues, source: 'fallback' };
        } catch (error) {
          logger?.warn({ error: error.message }, 'Gemini riddle adjustment failed, using fallback');
          return { clues: fallbackClues, source: 'fallback' };
        }
      },
      {
        onError: (err) => logger?.error({ error: err.message }, 'AI riddle cache fetch failed'),
      }
    );
  } catch (error) {
    logger?.error({ error: error.message }, 'Failed to generate riddle from Gemini API.');
    return { clues: fallbackClues, source: 'fallback' };
  }
}
