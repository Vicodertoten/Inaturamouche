// server/services/ai/aiPipeline.js
// Pipeline IA v7 — repere bref auto + explication detaillee a la demande.

import { randomUUID } from 'node:crypto';
import { config } from '../../config/index.js';
import { SmartCache } from '../../../lib/smart-cache.js';
import { MODEL_CONFIG, CACHE_VERSIONS, OUTPUT_CONSTRAINTS, EXPLANATION_CACHE_POLICIES } from './aiConfig.js';
import { recordClientEvent } from '../metricsStore.js';
import { collectEvidenceBundle, collectSpeciesData } from './ragSources.js';
import {
  calculateSeverity,
  buildBriefSystemPrompt,
  buildBriefUserParts,
  buildFullSystemPrompt,
  buildFullUserParts,
  buildRepairSystemPrompt,
  buildRepairUserParts,
  buildRiddleSystemPrompt,
  buildRiddleUserParts,
} from './promptBuilder.js';
import {
  parseExplanationModeResponse,
  validateBriefExplanation,
  validateFullExplanation,
  composeBriefDisplayText,
  buildBriefSupport,
  buildFullSupport,
  buildPedagogyBlocks,
  buildMorphologyFallback,
  buildFallbackRiddleClues,
  parseRiddleResponse,
  normalizeRiddleClues,
} from './outputFilter.js';

const { aiApiKey, aiEnabled } = config;
const shouldLogVerboseTraces = config.nodeEnv !== 'production';
const PROMPT_VERSIONS = {
  brief: 'brief-v3-stable-demo',
  full: 'full-v4-narrow-pair',
};

// ── Caches ──────────────────────────────────────────────────────

const briefExplanationCache = new SmartCache({
  max: 1000,
  ttl: 1000 * 60 * 60 * 24 * 7,
  staleTtl: 1000 * 60 * 60 * 24 * 30,
});

const fullExplanationCache = new SmartCache({
  max: 1000,
  ttl: 1000 * 60 * 60 * 24 * 14,
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

const getDisplayName = (taxon) => taxon?.preferred_common_name || taxon?.common_name || taxon?.name || null;

// ── Appel Gemini avec retry ─────────────────────────────────────

async function callGeminiWithRetry({
  model,
  timeoutMs,
  maxRetries,
  pricePerMillion,
  systemPrompt,
  userParts,
  genConfig,
  logger,
  label = 'gemini',
  metricsSessionId = null,
  metricsAnonUserId = null,
}) {
  const apiUrl = MODEL_CONFIG.apiUrlTemplate(model);
  const retryBudget = maxRetries || 1;

  const requestBody = {
    contents: [{ role: 'user', parts: userParts }],
    generationConfig: genConfig,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  };

  let lastError = null;

  for (let attempt = 1; attempt <= retryBudget; attempt++) {
    try {
      if (attempt > 1) {
        logger?.info?.({ attempt, label }, `Retry ${attempt}/${retryBudget}`);
        await sleep(1000 * attempt); // Backoff progressif
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': aiApiKey,
        },
        body: JSON.stringify(requestBody),
        signal: createTimeoutSignal(timeoutMs),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger?.error?.({ status: response.status, body: errorBody?.slice(0, 200), attempt }, `${label} API error`);

        // 429 (rate limit) ou 503 (overloaded) → retry
        if ((response.status === 429 || response.status >= 500) && attempt < retryBudget) {
          lastError = new Error(`Gemini ${response.status}`);
          continue;
        }
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Log usage
      const usage = data?.usageMetadata;
      if (usage) {
        const promptTokens = Number(usage.promptTokenCount ?? 0) || 0;
        const candidateTokens = Number(usage.candidatesTokenCount ?? 0) || 0;
        const totalTokens = Number(usage.totalTokenCount ?? promptTokens + candidateTokens) || 0;
        const inputPrice = Number(pricePerMillion?.input ?? 0) || 0;
        const outputPrice = Number(pricePerMillion?.output ?? 0) || 0;
        const estimatedCostUsd = Number(
          ((promptTokens * inputPrice + candidateTokens * outputPrice) / 1_000_000).toFixed(6)
        );
        logger?.info?.(
          {
            label,
            attempt,
            model,
            promptTokens,
            candidateTokens,
            totalTokens,
            estimatedCostUsd,
          },
          `${label} token usage`
        );
        void recordClientEvent({
          name: 'ai_usage',
          session_id: metricsSessionId || null,
          anon_user_id: metricsAnonUserId || null,
          properties: {
            label,
            model,
            prompt_tokens: promptTokens,
            candidate_tokens: candidateTokens,
            total_tokens: totalTokens,
            estimated_cost_usd: estimatedCostUsd,
          },
        }).catch(() => {});
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
      if (attempt >= retryBudget) throw err;
      logger?.warn?.({ error: err.message, attempt }, `${label} attempt failed, will retry`);
    }
  }

  throw lastError || new Error('All retries exhausted');
}

// ══════════════════════════════════════════════════════════════════
//  EXPLANATIONS
// ══════════════════════════════════════════════════════════════════

const DEFAULT_BRIEF_FALLBACK = {
  fr: "Le bon repere n'a pas pu etre genere tout de suite. Regarde surtout la silhouette generale et un detail structurel stable.",
  en: 'The quick hint could not be generated right away. Focus on the overall shape and one stable structural clue.',
  nl: 'De korte hint kon niet meteen worden gegenereerd. Kijk vooral naar het algemene silhouet en een stabiel structureel kenmerk.',
};

function getModeConfig(mode = 'full') {
  return mode === 'brief'
    ? MODEL_CONFIG.explanation.brief
    : MODEL_CONFIG.explanation.full;
}

function getFallbackMicrocopy(locale = 'fr') {
  return DEFAULT_BRIEF_FALLBACK[locale] || DEFAULT_BRIEF_FALLBACK.fr;
}

function buildSourceMap(sources = []) {
  return new Map(sources.map((source) => [source.id, source]));
}

function getReasonKeyFromError(error) {
  const message = String(error?.message || '');
  if (error?.name === 'AbortError' || /timeout|aborted/i.test(message)) return 'api_timeout';
  if (/empty response/i.test(message)) return 'empty_output';
  return 'api_error';
}

function dedupeReasonCodes(codes = []) {
  return Array.from(new Set(codes.filter(Boolean)));
}

function getCachePolicy(mode, result) {
  const table = EXPLANATION_CACHE_POLICIES[mode === 'brief' ? 'brief' : 'full'];
  if (result?.fallback) return table.fallback;
  if (result?.confidence === 'grounded') return table.success;
  if (result?.confidence === 'model_guided') return table.model_guided;
  return table.limited;
}

function classifyValidationIssues(issues = []) {
  return {
    rejectedForPairMismatch: issues.some((issue) => issue.includes('ne cite pas clairement les deux espèces')),
    rejectedForScopeDrift: issues.some(
      (issue) => issue.includes('derive hors paire') || issue.includes('trop générique pour cette paire')
    ),
  };
}

function buildBundleSummary(bundle) {
  return {
    descriptiveSourceCount:
      Number(bundle?.correct?.descriptionSources?.length || 0) + Number(bundle?.wrong?.descriptionSources?.length || 0),
    taxonomicSourceCount:
      Number(bundle?.correct?.taxonomySources?.length || 0) + Number(bundle?.wrong?.taxonomySources?.length || 0),
    promptFacts: [
      ...(bundle?.correct?.promptFacts?.description || []),
      ...(bundle?.wrong?.promptFacts?.description || []),
      ...(bundle?.contrastFacts || []),
    ]
      .slice(0, 6)
      .map((fact) => fact?.text || ''),
  };
}

async function repairExplanationOutput({
  rawText,
  mode,
  locale,
  logger,
  metricsSessionId = null,
  metricsAnonUserId = null,
}) {
  const repairConfig = MODEL_CONFIG.explanation.repair;
  return callGeminiWithRetry({
    model: repairConfig.model,
    timeoutMs: repairConfig.timeoutMs,
    maxRetries: repairConfig.maxRetries,
    pricePerMillion: repairConfig.pricePerMillion,
    systemPrompt: buildRepairSystemPrompt({ mode, locale }),
    userParts: buildRepairUserParts({ rawText, mode }),
    genConfig: mode === 'brief' ? MODEL_CONFIG.explanation.brief.generate : MODEL_CONFIG.explanation.full.generate,
    logger,
    label: `repair_${mode}`,
    metricsSessionId,
    metricsAnonUserId,
  });
}

function buildLegacyAliases(result, locale, correctTaxon, wrongTaxon) {
  const full = result.full;
  const brief = result.brief;
  const explanation =
    full?.explanation ||
    brief?.displayText ||
    getFallbackMicrocopy(locale);
  const discriminant = full?.discriminant || brief?.keyDifference || null;
  return {
    explanation,
    discriminant,
    pedagogy: buildPedagogyBlocks({
      visualClue: full?.visualClue || brief?.nextLookFor,
      taxonomicRule: full?.taxonomicRule || null,
      whyThisConfusionHappens: full?.whyThisConfusionHappens || brief?.whyTempting,
      explanation,
      correctName: getDisplayName(correctTaxon),
      wrongName: getDisplayName(wrongTaxon),
      locale,
    }),
  };
}

function buildBriefFallback(correctTaxon, wrongTaxon, locale, bundle) {
  const severity = calculateSeverity(correctTaxon, wrongTaxon);
  const fallback = buildMorphologyFallback(
    correctTaxon,
    wrongTaxon,
    severity,
    { taxonomy: bundle?.correct?.taxonomy, sources: bundle?.correct?.allSources?.map((source) => source.label) || [] },
    { taxonomy: bundle?.wrong?.taxonomy, sources: bundle?.wrong?.allSources?.map((source) => source.label) || [] }
  );
  const brief = {
    keyDifference: fallback.keyDifference || fallback.discriminant || fallback.pedagogy?.visualClue || getFallbackMicrocopy(locale),
    whyTempting:
      fallback.whyTempting ||
      fallback.pedagogy?.whyThisConfusionHappens ||
      (locale === 'en'
        ? 'the two species can look close at first glance'
        : locale === 'nl'
          ? 'de twee soorten kunnen op het eerste gezicht sterk op elkaar lijken'
          : 'les deux especes peuvent sembler proches au premier regard'),
    nextLookFor:
      fallback.nextLookFor ||
      fallback.pedagogy?.visualClue ||
      (locale === 'en'
        ? 'one stable field mark'
        : locale === 'nl'
          ? 'een stabiel veldkenmerk'
          : 'un caractere visible stable'),
    displayText: '',
    support: {
      level: 'fallback',
      sourceIds: [],
    },
    sourceIdsByField: {
      keyDifference: [],
      whyTempting: [],
      nextLookFor: [],
    },
  };
  brief.displayText = composeBriefDisplayText({
    keyDifference: brief.keyDifference,
    whyTempting: brief.whyTempting,
    nextLookFor: brief.nextLookFor,
    locale,
  });
  return {
    mode: 'brief',
    brief,
    full: null,
    sources: bundle?.sources || [],
    confidence: 'fallback',
    fallback: true,
    reasonCodes: ['fallback'],
    ...buildLegacyAliases({ brief, full: null }, locale, correctTaxon, wrongTaxon),
  };
}

function buildFullFallback(correctTaxon, wrongTaxon, locale, bundle) {
  const severity = calculateSeverity(correctTaxon, wrongTaxon);
  const fallback = buildMorphologyFallback(
    correctTaxon,
    wrongTaxon,
    severity,
    { taxonomy: bundle?.correct?.taxonomy, sources: bundle?.correct?.allSources?.map((source) => source.label) || [] },
    { taxonomy: bundle?.wrong?.taxonomy, sources: bundle?.wrong?.allSources?.map((source) => source.label) || [] }
  );
  const full = {
    explanation: fallback.explanation || getFallbackMicrocopy(locale),
    visualClue: fallback.pedagogy?.visualClue || getFallbackMicrocopy(locale),
    taxonomicRule: fallback.pedagogy?.taxonomicRule || getFallbackMicrocopy(locale),
    whyThisConfusionHappens:
      fallback.pedagogy?.whyThisConfusionHappens ||
      fallback.pedagogy?.counterExample ||
      getFallbackMicrocopy(locale),
    counterExample:
      fallback.pedagogy?.whyThisConfusionHappens ||
      fallback.pedagogy?.counterExample ||
      getFallbackMicrocopy(locale),
    discriminant: fallback.discriminant || null,
    support: {
      level: 'fallback',
      sourceIds: [],
    },
    supportByField: {
      explanation: [],
      visualClue: [],
      taxonomicRule: [],
      whyThisConfusionHappens: [],
      discriminant: [],
    },
    sourceIdsByField: {
      explanation: [],
      visualClue: [],
      taxonomicRule: [],
      whyThisConfusionHappens: [],
      discriminant: [],
    },
  };
  return {
    mode: 'full',
    brief: null,
    full,
    sources: bundle?.sources || [],
    confidence: 'fallback',
    fallback: true,
    reasonCodes: ['fallback'],
    ...buildLegacyAliases({ brief: null, full }, locale, correctTaxon, wrongTaxon),
  };
}

export async function generateCustomExplanation(
  correctTaxon,
  wrongTaxon,
  locale = 'fr',
  logger,
  {
    mode = 'full',
    focusRank: _focusRank = null,
    packId = null,
    gameMode = null,
    masteryBucket = null,
    confusionBucket = null,
    metricsSessionId = null,
    metricsAnonUserId = null,
    imageContext = null,
  } = {}
) {
  const traceId = randomUUID();
  const pairKey = `${correctTaxon?.id || 'na'}:${wrongTaxon?.id || 'na'}:${locale}:${mode}`;
  if (!aiEnabled || !aiApiKey) {
    logger?.warn?.('AI explanations disabled or no API key');
    const bundle = await collectEvidenceBundle(correctTaxon, wrongTaxon, locale, { logger }).catch(() => ({
      sources: [],
      correct: null,
      wrong: null,
    }));
    const fallbackResult = mode === 'brief'
      ? buildBriefFallback(correctTaxon, wrongTaxon, locale, bundle)
      : buildFullFallback(correctTaxon, wrongTaxon, locale, bundle);
    return { ...fallbackResult, traceId, pairKey, severity: calculateSeverity(correctTaxon, wrongTaxon) };
  }

  if (!correctTaxon || !wrongTaxon) {
    throw new Error('Both correct and wrong taxon details are required.');
  }

  const severity = calculateSeverity(correctTaxon, wrongTaxon);
  if (mode === 'full' && !config.aiExplanationFullEnabled) {
    const bundle = await collectEvidenceBundle(correctTaxon, wrongTaxon, locale, { logger }).catch(() => ({
      sources: [],
      correct: null,
      wrong: null,
    }));
    const disabledResult = buildFullFallback(correctTaxon, wrongTaxon, locale, bundle);
    disabledResult.reasonCodes = dedupeReasonCodes([...(disabledResult.reasonCodes || []), 'full_disabled']);
    return { ...disabledResult, traceId, pairKey, severity };
  }
  const cacheKey = `${
    mode === 'brief' ? CACHE_VERSIONS.briefExplanation : CACHE_VERSIONS.fullExplanation
  }:${locale}:${correctTaxon.id}-${wrongTaxon.id}:${masteryBucket || 'na'}:${confusionBucket || 'na'}`;
  const cache = mode === 'brief' ? briefExplanationCache : fullExplanationCache;
  const modelConfig = getModeConfig(mode);
  const cacheEntryBefore = cache.getEntry(cacheKey);
  const cacheStatus = cacheEntryBefore ? (cacheEntryBefore.isStale ? 'stale' : 'hit') : 'miss';

  try {
    const result = await cache.getOrFetch(
      cacheKey,
      async () => {
        const bundle = await collectEvidenceBundle(correctTaxon, wrongTaxon, locale, { logger });
        const sourceMap = buildSourceMap(bundle.sources);
        const bundleSummary = buildBundleSummary(bundle);
        const reasonCodes = [];
        let result = null;
        let parsed = null;
        let repaired = false;
        let rawText = null;
        let repairedText = null;

        logger?.info?.(
          {
            traceId,
            pairKey,
            mode,
            severity,
            cacheStatus,
            model: modelConfig.model,
            promptVersion: PROMPT_VERSIONS[mode],
            bundleSummary,
          },
          'Starting explanation generation'
        );

        try {
          rawText = await callGeminiWithRetry({
            model: modelConfig.model,
            timeoutMs: modelConfig.timeoutMs,
            maxRetries: modelConfig.maxRetries,
            pricePerMillion: modelConfig.pricePerMillion,
            systemPrompt:
              mode === 'brief'
                ? buildBriefSystemPrompt({ severity, locale })
                : buildFullSystemPrompt({ severity, locale }),
            userParts:
              mode === 'brief'
                ? buildBriefUserParts({
                    correctTaxon,
                    wrongTaxon,
                    severity,
                    bundle,
                    packId,
                    gameMode,
                    masteryBucket,
                    confusionBucket,
                  })
                : buildFullUserParts({
                    correctTaxon,
                    wrongTaxon,
                    severity,
                    bundle,
                    packId,
                    gameMode,
                    masteryBucket,
                    confusionBucket,
                    imageContext: config.aiExplanationFullImageAware ? imageContext : null,
                  }),
            genConfig: modelConfig.generate,
            logger,
            label: `explain_${mode}`,
            metricsSessionId,
            metricsAnonUserId,
          });

          logger?.info?.(
            {
              traceId,
              pairKey,
              mode,
              rawLength: rawText.length,
              rawText: shouldLogVerboseTraces ? rawText : undefined,
            },
            'AI raw response received'
          );

          parsed = parseExplanationModeResponse(rawText, mode, {
            correctName: getDisplayName(correctTaxon),
            wrongName: getDisplayName(wrongTaxon),
            locale,
          });
          if (!parsed) {
            reasonCodes.push('json_parse_failed');
            logger?.warn?.({ textSlice: rawText.slice(0, 200), mode }, 'Could not parse AI response');
            try {
              repairedText = await repairExplanationOutput({
                rawText,
                mode,
                locale,
                logger,
                metricsSessionId,
                metricsAnonUserId,
              });
              parsed = parseExplanationModeResponse(repairedText, mode, {
                correctName: getDisplayName(correctTaxon),
                wrongName: getDisplayName(wrongTaxon),
                locale,
              });
              if (parsed) {
                repaired = true;
                reasonCodes.push('repair_used');
                logger?.info?.(
                  {
                    traceId,
                    pairKey,
                    mode,
                    repairedText: shouldLogVerboseTraces ? repairedText : undefined,
                  },
                  'Repair pass succeeded'
                );
              } else {
                reasonCodes.push('repair_failed');
              }
            } catch (repairError) {
              reasonCodes.push('repair_failed');
              logger?.warn?.({ error: repairError.message, mode }, 'Repair pass failed');
            }
          }

          if (parsed && mode === 'brief') {
            const validation = validateBriefExplanation(parsed, {
              correctName: getDisplayName(correctTaxon),
              wrongName: getDisplayName(wrongTaxon),
              locale,
              sourceMap,
            });
            if (validation.valid) {
              const support = buildBriefSupport(validation.brief, bundle, sourceMap);
              const confidence = support.level;
              if (confidence === 'limited') reasonCodes.push('attribution_weak');
              if (
                Number(bundle?.correct?.descriptionSources?.length || 0) === 0 ||
                Number(bundle?.wrong?.descriptionSources?.length || 0) === 0
              ) {
                reasonCodes.push('evidence_missing');
              }
              const brief = {
                ...validation.brief,
                displayText:
                  validation.brief.displayText ||
                  composeBriefDisplayText({ ...validation.brief, locale }),
                support,
                supportByField: support.sourceIdsByField,
                sourceIdsByField: support.sourceIdsByField,
              };
              logger?.info?.(
                {
                  traceId,
                  pairKey,
                  mode,
                  parsedPayload: shouldLogVerboseTraces ? parsed : undefined,
                  validationWarnings: validation.warnings,
                  supportByField: support.sourceIdsByField,
                  confidence,
                },
                'Brief explanation accepted'
              );
              result = {
                mode: 'brief',
                brief,
                full: null,
                sources: bundle.sources,
                confidence,
                fallback: false,
                reasonCodes: dedupeReasonCodes(reasonCodes),
                ...buildLegacyAliases({ brief, full: null }, locale, correctTaxon, wrongTaxon),
              };
            } else {
              reasonCodes.push('quality_rejected');
              logger?.warn?.(
                {
                  traceId,
                  pairKey,
                  mode,
                  parsedPayload: shouldLogVerboseTraces ? parsed : undefined,
                  validationIssues: validation.issues,
                  validationWarnings: validation.warnings,
                },
                'Brief AI response rejected'
              );
            }
          } else if (parsed) {
            const validation = validateFullExplanation(parsed, {
              correctName: getDisplayName(correctTaxon),
              wrongName: getDisplayName(wrongTaxon),
              correctScientificName: correctTaxon?.name || null,
              wrongScientificName: wrongTaxon?.name || null,
              locale,
              sourceMap,
            });
            if (validation.valid) {
              const support = buildFullSupport(validation.full, bundle, sourceMap);
              const confidence = support.level;
              if (confidence === 'limited') reasonCodes.push('attribution_weak');
              if (
                Number(bundle?.correct?.descriptionSources?.length || 0) === 0 ||
                Number(bundle?.wrong?.descriptionSources?.length || 0) === 0
              ) {
                reasonCodes.push('evidence_missing');
              }
              const full = {
                ...validation.full,
                support: {
                  level: support.level,
                  sourceIds: support.sourceIds,
                },
                supportByField: support.supportByField,
                sourceIdsByField: support.supportByField,
              };
              logger?.info?.(
                {
                  traceId,
                  pairKey,
                  mode,
                  parsedPayload: shouldLogVerboseTraces ? parsed : undefined,
                  validationWarnings: validation.warnings,
                  supportByField: support.supportByField,
                  confidence,
                },
                'Full explanation accepted'
              );
              result = {
                mode: 'full',
                brief: null,
                full,
                sources: bundle.sources,
                confidence,
                fallback: false,
                reasonCodes: dedupeReasonCodes(reasonCodes),
                ...buildLegacyAliases({ brief: null, full }, locale, correctTaxon, wrongTaxon),
              };
            } else {
              reasonCodes.push('quality_rejected');
              const classification = classifyValidationIssues(validation.issues);
              if (classification.rejectedForPairMismatch) reasonCodes.push('pair_mismatch');
              if (classification.rejectedForScopeDrift) reasonCodes.push('scope_drift');
              logger?.warn?.(
                {
                  traceId,
                  pairKey,
                  mode,
                  parsedPayload: shouldLogVerboseTraces ? parsed : undefined,
                  validationIssues: validation.issues,
                  validationWarnings: validation.warnings,
                  ...classification,
                },
                'Full AI response rejected'
              );
            }
          }
        } catch (aiError) {
          reasonCodes.push(getReasonKeyFromError(aiError));
          logger?.error?.({ error: aiError.message }, 'Gemini call failed after retries');
        }

        if (!result) {
          logger?.info?.(
            {
              traceId,
              pairKey,
              severity,
              mode,
              group: correctTaxon?.iconic_taxon_name,
              reasonCodes,
            },
            'Using explanation fallback'
          );
          result =
            mode === 'brief'
              ? buildBriefFallback(correctTaxon, wrongTaxon, locale, bundle)
              : buildFullFallback(correctTaxon, wrongTaxon, locale, bundle);
          result.reasonCodes = dedupeReasonCodes([...reasonCodes, ...(result.reasonCodes || []), 'cached_fallback_prevented']);
        }

        if (repaired && result && !result.fallback) {
          result.reasonCodes = dedupeReasonCodes([...(result.reasonCodes || []), 'repair_used']);
        }

        return result;
      },
      {
        onError: (err) => logger?.error?.({ error: err.message }, 'Explanation cache error'),
      }
    );

    const cachePolicy = getCachePolicy(mode, result);
    cache.set(cacheKey, result, cachePolicy);

    void recordClientEvent({
      name: 'explanation_pipeline_result',
      session_id: metricsSessionId || null,
      anon_user_id: metricsAnonUserId || null,
      properties: {
        trace_id: traceId,
        pair_key: pairKey,
        mode,
        model: modelConfig.model,
        cache_status: cacheStatus,
        prompt_version: PROMPT_VERSIONS[mode],
        severity,
        confidence: result?.confidence || 'fallback',
        fallback: Boolean(result?.fallback),
        brief_or_full_confidence: result?.confidence || 'fallback',
        descriptive_source_count:
          Number(result?.sources?.filter?.((source) => source?.kind === 'description')?.length || 0),
        taxonomic_source_count:
          Number(
            result?.sources?.filter?.((source) => ['taxonomy', 'synonymy'].includes(source?.kind))?.length || 0
          ),
        rejected_for_pair_mismatch: Array.isArray(result?.reasonCodes) ? result.reasonCodes.includes('pair_mismatch') : false,
        rejected_for_scope_drift: Array.isArray(result?.reasonCodes) ? result.reasonCodes.includes('scope_drift') : false,
        reason_codes: Array.isArray(result?.reasonCodes) ? result.reasonCodes.join('|').slice(0, 300) : null,
      },
    }).catch(() => {});

    return {
      ...result,
      traceId,
      pairKey,
      severity,
    };
  } catch (error) {
    logger?.error?.({ error: error.message }, 'Failed to generate explanation');
    const bundle = await collectEvidenceBundle(correctTaxon, wrongTaxon, locale, { logger }).catch(() => ({
      sources: [],
      correct: null,
      wrong: null,
    }));
    const fallbackResult = mode === 'brief'
      ? buildBriefFallback(correctTaxon, wrongTaxon, locale, bundle)
      : buildFullFallback(correctTaxon, wrongTaxon, locale, bundle);
    fallbackResult.reasonCodes = dedupeReasonCodes([...(fallbackResult.reasonCodes || []), getReasonKeyFromError(error)]);
    cache.set(cacheKey, fallbackResult, getCachePolicy(mode, fallbackResult));
    return {
      ...fallbackResult,
      traceId,
      pairKey,
      severity,
    };
  }
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
          model: MODEL_CONFIG.riddle.model,
          timeoutMs: MODEL_CONFIG.riddle.timeoutMs,
          maxRetries: MODEL_CONFIG.riddle.maxRetries,
          pricePerMillion: MODEL_CONFIG.riddle.pricePerMillion,
          systemPrompt: buildRiddleSystemPrompt({ locale }),
          userParts: buildRiddleUserParts({ targetTaxon, locale, speciesData }),
          genConfig: MODEL_CONFIG.riddle.generate,
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
