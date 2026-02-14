// server/services/ai/aiPipeline.js
// Pipeline IA v6 — robuste avec retry, parsing texte brut, fallback intelligent

import { config } from '../../config/index.js';
import { SmartCache } from '../../../lib/smart-cache.js';
import { MODEL_CONFIG, CACHE_VERSIONS, OUTPUT_CONSTRAINTS } from './aiConfig.js';
import { collectSpeciesData } from './ragSources.js';
import {
  calculateSeverity,
  buildExplanationSystemPrompt,
  buildExplanationUserParts,
  buildRiddleSystemPrompt,
  buildRiddleUserParts,
} from './promptBuilder.js';
import {
  parseAIResponse,
  validateAndClean,
  buildMorphologyFallback,
  buildFallbackRiddleClues,
  parseRiddleResponse,
  normalizeRiddleClues,
} from './outputFilter.js';

const { aiApiKey, aiEnabled } = config;

// ── Caches ──────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────

const createTimeoutSignal = (ms) => {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Appel Gemini avec retry ─────────────────────────────────────

async function callGeminiWithRetry({ systemPrompt, userParts, genConfig, logger, label = 'gemini' }) {
  const apiUrl = MODEL_CONFIG.apiUrlTemplate(MODEL_CONFIG.model);
  const maxRetries = MODEL_CONFIG.maxRetries || 2;

  const requestBody = {
    contents: [{ role: 'user', parts: userParts }],
    generationConfig: genConfig,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  };

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        logger?.info?.({ attempt, label }, `Retry ${attempt}/${maxRetries}`);
        await sleep(1000 * attempt); // Backoff progressif
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': aiApiKey,
        },
        body: JSON.stringify(requestBody),
        signal: createTimeoutSignal(MODEL_CONFIG.timeoutMs),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger?.error?.({ status: response.status, body: errorBody?.slice(0, 200), attempt }, `${label} API error`);

        // 429 (rate limit) ou 503 (overloaded) → retry
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          lastError = new Error(`Gemini ${response.status}`);
          continue;
        }
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Log usage
      const usage = data?.usageMetadata;
      if (usage) {
        logger?.info?.(
          {
            label,
            attempt,
            model: MODEL_CONFIG.model,
            promptTokens: usage.promptTokenCount ?? null,
            candidateTokens: usage.candidatesTokenCount ?? null,
            totalTokens: usage.totalTokenCount ?? null,
          },
          `${label} token usage`
        );
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        logger?.warn?.({ apiResponse: JSON.stringify(data).slice(0, 300), attempt }, `${label} empty response`);
        if (attempt < maxRetries) {
          lastError = new Error('Empty response');
          continue;
        }
        throw new Error(`Empty response from ${label}`);
      }

      return text;
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries) throw err;
      logger?.warn?.({ error: err.message, attempt }, `${label} attempt failed, will retry`);
    }
  }

  throw lastError || new Error('All retries exhausted');
}

// ══════════════════════════════════════════════════════════════════
//  EXPLANATIONS
// ══════════════════════════════════════════════════════════════════

export async function generateCustomExplanation(
  correctTaxon,
  wrongTaxon,
  locale = 'fr',
  logger,
  { focusRank = null } = {}
) {
  if (!aiEnabled || !aiApiKey) {
    logger?.warn?.('AI explanations disabled or no API key');
    return {
      explanation: 'Papy Mouche fait une pause, explication indisponible.',
      discriminant: null,
      sources: [],
      fallback: true,
    };
  }

  if (!correctTaxon || !wrongTaxon) {
    throw new Error('Both correct and wrong taxon details are required.');
  }

  const severity = calculateSeverity(correctTaxon, wrongTaxon);
  const cacheKey = `${CACHE_VERSIONS.explanation}:${locale}:${correctTaxon.id}-${wrongTaxon.id}`;

  try {
    return await explanationCache.getOrFetch(
      cacheKey,
      async () => {
        // ── Étape 1 : Collecter les données ─────────────────────
        const [dataCorrect, dataWrong] = await Promise.all([
          collectSpeciesData(correctTaxon, locale, { logger }),
          collectSpeciesData(wrongTaxon, locale, { logger }),
        ]);

        logger?.info?.(
          {
            severity,
            correctSources: dataCorrect.sources,
            wrongSources: dataWrong.sources,
            correctDescCount: dataCorrect.descriptions?.length || 0,
            wrongDescCount: dataWrong.descriptions?.length || 0,
          },
          'Species data collected for explanation'
        );

        // ── Étape 2 : Appel Gemini (avec retry) ────────────────
        let result = null;
        try {
          const text = await callGeminiWithRetry({
            systemPrompt: buildExplanationSystemPrompt({ severity, locale }),
            userParts: buildExplanationUserParts({
              correctTaxon,
              wrongTaxon,
              locale,
              severity,
              dataCorrect,
              dataWrong,
            }),
            genConfig: MODEL_CONFIG.generate,
            logger,
            label: 'explain',
          });

          logger?.info?.({ rawLength: text.length }, 'AI raw response received');

          const parsed = parseAIResponse(text);
          if (parsed) {
            const validation = validateAndClean(parsed);

            if (validation.explanation) {
              // v6: on accepte même si c'est "pas parfait" — mieux que le fallback
              if (validation.issues.length > 0) {
                logger?.info?.({ issues: validation.issues }, 'AI response has issues, keeping anyway');
              }
              result = {
                explanation: validation.explanation,
                discriminant: validation.discriminant || null,
                sources: mergeAllSources(dataCorrect, dataWrong),
                fallback: false,
              };
            }
          } else {
            logger?.warn?.({ textSlice: text.slice(0, 200) }, 'Could not parse AI response');
          }
        } catch (aiError) {
          logger?.error?.({ error: aiError.message }, 'Gemini call failed after retries');
        }

        // ── Étape 3 : Fallback intelligent ──────────────────────
        if (!result) {
          logger?.info?.({ severity, group: correctTaxon?.iconic_taxon_name }, 'Using taxonomic group fallback');
          result = buildMorphologyFallback(
            correctTaxon,
            wrongTaxon,
            severity,
            dataCorrect,
            dataWrong,
          );
        }

        return result;
      },
      {
        onError: (err) => logger?.error?.({ error: err.message }, 'Explanation cache error'),
      }
    );
  } catch (error) {
    logger?.error?.({ error: error.message }, 'Failed to generate explanation');
    return {
      explanation: 'Papy Mouche a un trou de mémoire, reviens plus tard !',
      discriminant: null,
      sources: [],
      fallback: true,
    };
  }
}

// ── Merge des sources ───────────────────────────────────────────

function mergeAllSources(dataCorrect, dataWrong) {
  const all = [
    ...(dataCorrect?.sources || []),
    ...(dataWrong?.sources || []),
  ];
  return [...new Set(all)].slice(0, 3);
}

// ══════════════════════════════════════════════════════════════════
//  RIDDLES
// ══════════════════════════════════════════════════════════════════

export async function generateRiddle(targetTaxon, locale = 'fr', logger) {
  if (!targetTaxon) {
    throw new Error('Target taxon details are required.');
  }

  let speciesData;
  try {
    speciesData = await collectSpeciesData(targetTaxon, locale, { logger });
  } catch (err) {
    logger?.warn?.({ error: err.message }, 'Data collection failed for riddle');
    speciesData = { descriptions: [], description: '', sources: [], taxonomy: {}, contextText: '' };
  }

  const fallbackClues = buildFallbackRiddleClues(targetTaxon, speciesData);

  if (!aiEnabled || !aiApiKey) {
    return { clues: fallbackClues, sources: speciesData.sources, source: 'fallback' };
  }

  const cacheKey = `${CACHE_VERSIONS.riddle}:${locale}:${targetTaxon.id}`;
  const clueCount = OUTPUT_CONSTRAINTS.riddle.clueCount;

  try {
    return await riddleCache.getOrFetch(
      cacheKey,
      async () => {
        const text = await callGeminiWithRetry({
          systemPrompt: buildRiddleSystemPrompt({ locale }),
          userParts: buildRiddleUserParts({ targetTaxon, locale, speciesData }),
          genConfig: MODEL_CONFIG.riddle,
          logger,
          label: 'riddle',
        });

        const parsed = parseRiddleResponse(text);
        const normalized = normalizeRiddleClues(parsed.clues, targetTaxon);

        if (normalized.length >= clueCount) {
          return {
            clues: normalized.slice(0, clueCount),
            sources: speciesData.sources.length > 0 ? speciesData.sources : ['iNaturalist'],
            source: 'ai',
          };
        }

        const filled = normalized.concat(fallbackClues).slice(0, clueCount);
        return {
          clues: filled,
          sources: speciesData.sources.length > 0 ? speciesData.sources : ['iNaturalist'],
          source: normalized.length > 0 ? 'ai' : 'fallback',
        };
      },
      {
        onError: (err) => logger?.error?.({ error: err.message }, 'Riddle cache error'),
      }
    );
  } catch (error) {
    logger?.error?.({ error: error.message }, 'Failed to generate riddle');
    return { clues: fallbackClues, sources: speciesData.sources, source: 'fallback' };
  }
}
