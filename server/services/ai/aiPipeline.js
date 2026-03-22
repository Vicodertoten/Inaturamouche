// server/services/ai/aiPipeline.js
// Pipeline IA v7 — repere bref auto + explication detaillee a la demande.

import { createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { config } from '../../config/index.js';
import { SmartCache } from '../../../lib/smart-cache.js';
import {
  MODEL_CONFIG,
  CACHE_VERSIONS,
  OUTPUT_CONSTRAINTS,
  EXPLANATION_CACHE_POLICIES,
  IMAGE_FETCH_SECURITY,
} from './aiConfig.js';
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

const shouldLogVerboseTraces = config.nodeEnv !== 'production';
const PROMPT_VERSIONS = {
  brief: 'brief-v3-stable-demo',
  full: 'full-v5-photo-analysis',
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
const PHOTO_SOURCE_ID = 'round-photo';
const ALLOWED_IMAGE_HOSTS = new Set(IMAGE_FETCH_SECURITY.allowedHosts);

function hashValue(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
}

function isAllowedImageHost(hostname) {
  return ALLOWED_IMAGE_HOSTS.has(String(hostname || '').toLowerCase());
}

function isPrivateIpv4Address(address) {
  const parts = String(address || '')
    .split('.')
    .map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  if (parts[0] === 10 || parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  if (parts[0] === 0) return true;
  return false;
}

function isPrivateIpv6Address(address) {
  const normalized = String(address || '').toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./u.test(normalized)
  );
}

function isPrivateIpAddress(address) {
  const family = isIP(String(address || ''));
  if (family === 4) return isPrivateIpv4Address(address);
  if (family === 6) return isPrivateIpv6Address(address);
  return false;
}

async function assertSafeImageUrl(rawUrl) {
  const url = new URL(String(rawUrl || ''));
  if (url.protocol !== 'https:') {
    throw new Error('Image URL protocol rejected');
  }
  if (url.username || url.password) {
    throw new Error('Image URL credentials rejected');
  }
  if (url.port && url.port !== '443') {
    throw new Error('Image URL port rejected');
  }
  if (!isAllowedImageHost(url.hostname)) {
    throw new Error('Image host rejected');
  }
  if (isIP(url.hostname) && isPrivateIpAddress(url.hostname)) {
    throw new Error('Image IP rejected');
  }

  const resolvedAddresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!Array.isArray(resolvedAddresses) || resolvedAddresses.length === 0) {
    throw new Error('Image host resolution failed');
  }
  if (resolvedAddresses.some((entry) => isPrivateIpAddress(entry?.address))) {
    throw new Error('Image host resolved to private IP');
  }

  return url;
}

function guessMimeType(url, contentTypeHeader) {
  const header = String(contentTypeHeader || '').toLowerCase();
  if (header.startsWith('image/')) return header.split(';')[0];
  const lowerUrl = String(url || '').toLowerCase();
  if (lowerUrl.endsWith('.png')) return 'image/png';
  if (lowerUrl.endsWith('.webp')) return 'image/webp';
  if (lowerUrl.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function readResponseBytesLimited(response, maxBytes) {
  const contentLengthHeader = response.headers.get('content-length');
  const declaredLength = Number.parseInt(String(contentLengthHeader || ''), 10);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Image too large: declared=${declaredLength}`);
  }

  const reader = response.body?.getReader?.();
  if (!reader) {
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Image decode failed');
    }
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error(`Image too large: actual=${arrayBuffer.byteLength}`);
    }
    return Buffer.from(arrayBuffer);
  }

  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel('image_too_large').catch(() => {});
      throw new Error(`Image too large: streamed=${totalBytes}`);
    }
    chunks.push(chunk);
  }

  if (totalBytes === 0) {
    throw new Error('Image decode failed');
  }
  return Buffer.concat(chunks, totalBytes);
}

export async function fetchImageInlinePart(imageContext, logger) {
  if (!imageContext?.url) {
    throw new Error('Image context missing URL');
  }

  const safeUrl = await assertSafeImageUrl(imageContext.url);
  const response = await fetch(safeUrl, {
    headers: {
      Accept: 'image/*',
    },
    redirect: 'manual',
    signal: createTimeoutSignal(IMAGE_FETCH_SECURITY.timeoutMs),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`Image redirect refused: ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`);
  }
  const contentTypeHeader = response.headers.get('content-type');
  if (!/^image\//iu.test(String(contentTypeHeader || ''))) {
    throw new Error(`Image content-type rejected: ${contentTypeHeader || 'missing'}`);
  }
  const mimeType = guessMimeType(safeUrl.href, contentTypeHeader);
  const buffer = await readResponseBytesLimited(response, IMAGE_FETCH_SECURITY.maxBytes);
  return {
    inline_data: {
      mime_type: mimeType,
      data: buffer.toString('base64'),
    },
    meta: {
      source: imageContext.source || 'round_photo',
      downscaled: Boolean(imageContext?.downscaled),
      inputBucket: imageContext?.inputBucket || '<=384-target',
      width: imageContext?.width || null,
      height: imageContext?.height || null,
    },
  };
}

function buildRoundPhotoSource(imageContext) {
  if (!imageContext?.url) return null;
  return {
    id: PHOTO_SOURCE_ID,
    provider: 'round_photo',
    kind: 'image',
    label: 'Photo du round',
    url: imageContext.url,
    lang: 'unknown',
    license: null,
    snippet: '',
  };
}

// ── Appel Gemini avec retry ─────────────────────────────────────

function parseRetryAfterMs(headerValue) {
  if (!headerValue) return null;
  const seconds = Number.parseFloat(String(headerValue).trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const asDate = Date.parse(String(headerValue));
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return null;
}

function computeRetryDelayMs(attemptNumber, retryAfterHeader) {
  const baseDelayMs = Math.min(5_000, 500 * (2 ** Math.max(0, attemptNumber - 1)));
  const jitterMs = Math.floor(Math.random() * 250);
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
  return Math.max(baseDelayMs + jitterMs, retryAfterMs || 0);
}

function isRetriableGeminiError(error) {
  const message = String(error?.message || '');
  return error?.name === 'AbortError' || /timeout|aborted|network|fetch failed/i.test(message);
}

export async function callGeminiWithRetry({
  model,
  timeoutMs,
  maxAttempts,
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
  const attemptBudget = Math.max(1, Number(maxAttempts) || 1);

  const requestBody = {
    contents: [{ role: 'user', parts: userParts }],
    generationConfig: genConfig,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  };

  let lastError = null;

  for (let attempt = 1; attempt <= attemptBudget; attempt++) {
    try {
      if (attempt > 1) {
        logger?.info?.({ attempt, maxAttempts: attemptBudget, label }, `Retry ${attempt}/${attemptBudget}`);
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.aiApiKey,
        },
        body: JSON.stringify(requestBody),
        signal: createTimeoutSignal(timeoutMs),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const retryAfterHeader = response.headers.get('retry-after');
        logger?.error?.(
          {
            status: response.status,
            body: errorBody?.slice(0, 200),
            attempt,
            retryAfter: retryAfterHeader || null,
          },
          `${label} API error`
        );

        if ((response.status === 429 || response.status >= 500) && attempt < attemptBudget) {
          const delayMs = computeRetryDelayMs(attempt, retryAfterHeader);
          logger?.warn?.({ attempt, delayMs, status: response.status, label }, `${label} will retry after API error`);
          await sleep(delayMs);
          lastError = new Error(`Gemini ${response.status}`);
          continue;
        }
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const finishReason = data?.candidates?.[0]?.finishReason || null;
      const promptFeedback = data?.promptFeedback || null;
      if (finishReason || promptFeedback) {
        logger?.info?.(
          {
            label,
            attempt,
            model,
            finishReason,
            promptFeedback,
          },
          `${label} generation metadata`
        );
      }

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
            finish_reason: finishReason,
            prompt_feedback_block_reason: promptFeedback?.blockReason || null,
          },
        }).catch(() => {});
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        logger?.warn?.({ apiResponse: JSON.stringify(data).slice(0, 300), attempt }, `${label} empty response`);
        if (attempt < attemptBudget) {
          const delayMs = computeRetryDelayMs(attempt, null);
          await sleep(delayMs);
          lastError = new Error(`Empty response (${finishReason || 'no_finish_reason'})`);
          continue;
        }
        throw new Error(`Empty response from ${label}`);
      }

      return text;
    } catch (err) {
      lastError = err;
      if (attempt >= attemptBudget || !isRetriableGeminiError(err)) throw err;
      const delayMs = computeRetryDelayMs(attempt, null);
      logger?.warn?.({ error: err.message, attempt, delayMs, label }, `${label} attempt failed, will retry`);
      await sleep(delayMs);
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

function getImageReasonKey(error) {
  const message = String(error?.message || '');
  if (/host rejected|protocol rejected|credentials rejected|port rejected|private ip/i.test(message)) {
    return 'image_security_rejected';
  }
  if (/content-type rejected/i.test(message)) return 'image_content_type_rejected';
  if (/too large/i.test(message)) return 'image_too_large';
  if (/redirect refused/i.test(message)) return 'image_redirect_rejected';
  if (/decode/i.test(message)) return 'image_decode_failed';
  return 'image_fetch_failed';
}

function getCachePolicy(mode, result) {
  const table = EXPLANATION_CACHE_POLICIES[mode === 'brief' ? 'brief' : 'full'];
  if (result?.fallback) return table.fallback;
  if (result?.confidence === 'grounded' || result?.confidence === 'photo_grounded') return table.success;
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
    maxAttempts: repairConfig.maxAttempts,
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
    full?.photoSummary ||
    full?.explanation ||
    brief?.displayText ||
    getFallbackMicrocopy(locale);
  const discriminant =
    (Array.isArray(full?.observedClues) ? full.observedClues[0] : null) ||
    full?.discriminant ||
    brief?.keyDifference ||
    null;
  return {
    explanation,
    discriminant,
    pedagogy: buildPedagogyBlocks({
      visualClue:
        (Array.isArray(full?.observedClues) ? full.observedClues.join(' · ') : null) ||
        full?.visualClue ||
        brief?.nextLookFor,
      taxonomicRule: full?.nextCheck || full?.taxonomicRule || null,
      whyThisConfusionHappens:
        full?.whyThisPhotoCouldMislead ||
        full?.whyThisConfusionHappens ||
        brief?.whyTempting,
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
    correctName: getDisplayName(correctTaxon),
    wrongName: getDisplayName(wrongTaxon),
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

function getFullFallbackCopy(locale = 'fr') {
  if (locale === 'en') {
    return {
      photoLead: 'I could not read this round photo reliably enough for a precise photo-only analysis.',
      whyPhotoCouldMislead: 'This image hides the best field mark or flattens the proportions at first glance.',
      caution: 'Photo-specific analysis unavailable: use the stable pair clue instead.',
    };
  }
  if (locale === 'nl') {
    return {
      photoLead: 'Ik kon deze rondefoto niet betrouwbaar genoeg lezen voor een echt foto-specifieke analyse.',
      whyPhotoCouldMislead: 'Deze afbeelding verbergt het beste kenmerk of maakt de verhoudingen op het eerste gezicht vlakker.',
      caution: 'Fotoanalyse niet beschikbaar: gebruik het stabiele verschil tussen dit soortenpaar.',
    };
  }
  return {
    photoLead: "Je n'ai pas pu lire cette photo de manche assez finement pour une analyse purement photo.",
    whyPhotoCouldMislead:
      "Cette image masque probablement le meilleur critère ou tasse les proportions au premier regard.",
    caution: 'Analyse photo indisponible : garde le repère stable propre à cette paire.',
  };
}

function buildFallbackObservedClues(fallback) {
  const discriminantClues = String(fallback?.discriminant || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const extraClues = [
    fallback?.keyDifference,
    fallback?.nextLookFor,
  ]
    .map((value) => String(value || '').replace(/[.:!?]+$/u, '').trim())
    .filter(Boolean);

  return Array.from(new Set([...discriminantClues, ...extraClues]))
    .map((value) => value.replace(/^Observe d'abord\s+/iu, '').replace(/^Regarde d'abord\s+/iu, '').trim())
    .filter((value) => value.split(/\s+/).filter(Boolean).length <= 12)
    .slice(0, 3);
}

function buildFullFallback(correctTaxon, wrongTaxon, locale, bundle, imageContext, reasonCodes = []) {
  const severity = calculateSeverity(correctTaxon, wrongTaxon);
  const copy = getFullFallbackCopy(locale);
  const morphologyFallback = buildMorphologyFallback(
    correctTaxon,
    wrongTaxon,
    severity,
    {
      taxonomy: bundle?.correct?.taxonomy,
      sources: bundle?.correct?.allSources?.map((source) => source.label) || [],
      claims: bundle?.correct?.claims,
    },
    {
      taxonomy: bundle?.wrong?.taxonomy,
      sources: bundle?.wrong?.allSources?.map((source) => source.label) || [],
      claims: bundle?.wrong?.claims,
    }
  );
  const observedClues = buildFallbackObservedClues(morphologyFallback);
  const full = {
    photoSummary: `${copy.photoLead} ${morphologyFallback.keyDifference}`.trim(),
    observedClues,
    whyThisPhotoCouldMislead: morphologyFallback.whyTempting || copy.whyPhotoCouldMislead,
    nextCheck: morphologyFallback.nextLookFor,
    caution: copy.caution,
    support: {
      level: 'fallback',
      sourceIds: [],
    },
    supportByField: {
      photoSummary: [],
      observedClues: [],
      whyThisPhotoCouldMislead: [],
      nextCheck: [],
      caution: [],
    },
    sourceIdsByField: {
      photoSummary: [],
      observedClues: [],
      whyThisPhotoCouldMislead: [],
      nextCheck: [],
      caution: [],
    },
    imageAnalysis: {
      source: imageContext?.source || 'round_photo',
      downscaled: Boolean(imageContext?.downscaled),
      inputBucket: imageContext?.inputBucket || '<=384-target',
      imageAvailable: Boolean(imageContext?.url),
    },
  };
  return {
    mode: 'full',
    brief: null,
    full,
    sources: bundle?.sources || [],
    confidence: 'fallback',
    fallback: true,
    reasonCodes: dedupeReasonCodes(['fallback', 'full_unavailable', ...reasonCodes]),
    ...buildLegacyAliases({ brief: null, full }, locale, correctTaxon, wrongTaxon),
  };
}

export function buildExplanationCacheKey({
  mode = 'full',
  locale = 'fr',
  correctTaxon,
  wrongTaxon,
  packId = null,
  gameMode = null,
  masteryBucket = null,
  confusionBucket = null,
  imageContext = null,
}) {
  const fullImageKey = mode === 'full' ? hashValue(imageContext?.url || 'no-image') : null;
  const promptVersion = PROMPT_VERSIONS[mode] || 'unknown';
  return `${
    mode === 'brief' ? CACHE_VERSIONS.briefExplanation : CACHE_VERSIONS.fullExplanation
  }:${promptVersion}:${locale}:${correctTaxon?.id || 'na'}-${wrongTaxon?.id || 'na'}:${packId || 'na'}:${
    gameMode || 'na'
  }:${masteryBucket || 'na'}:${confusionBucket || 'na'}${fullImageKey ? `:${fullImageKey}` : ''}`;
}

export async function generateCustomExplanation(
  correctTaxon,
  wrongTaxon,
  locale = 'fr',
  logger,
  {
    mode = 'full',
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
  if (!config.aiEnabled || !config.aiApiKey) {
    logger?.warn?.('AI explanations disabled or no API key');
    const bundle = await collectEvidenceBundle(correctTaxon, wrongTaxon, locale, { logger }).catch(() => ({
      sources: [],
      correct: null,
      wrong: null,
    }));
    const fallbackResult = mode === 'brief'
      ? buildBriefFallback(correctTaxon, wrongTaxon, locale, bundle)
      : buildFullFallback(correctTaxon, wrongTaxon, locale, bundle, imageContext, ['ai_disabled']);
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
    const disabledResult = buildFullFallback(correctTaxon, wrongTaxon, locale, bundle, imageContext, ['full_disabled']);
    return { ...disabledResult, traceId, pairKey, severity };
  }
  if (mode === 'full' && !config.aiExplanationFullImageAware) {
    const bundle = await collectEvidenceBundle(correctTaxon, wrongTaxon, locale, { logger }).catch(() => ({
      sources: [],
      correct: null,
      wrong: null,
    }));
    const disabledResult = buildFullFallback(
      correctTaxon,
      wrongTaxon,
      locale,
      bundle,
      imageContext,
      ['full_photo_disabled']
    );
    return { ...disabledResult, traceId, pairKey, severity };
  }
  if (mode === 'full' && !imageContext?.url) {
    const bundle = await collectEvidenceBundle(correctTaxon, wrongTaxon, locale, { logger }).catch(() => ({
      sources: [],
      correct: null,
      wrong: null,
    }));
    const unavailableResult = buildFullFallback(
      correctTaxon,
      wrongTaxon,
      locale,
      bundle,
      imageContext,
      ['image_missing']
    );
    return { ...unavailableResult, traceId, pairKey, severity };
  }
  const cacheKey = buildExplanationCacheKey({
    mode,
    locale,
    correctTaxon,
    wrongTaxon,
    packId,
    gameMode,
    masteryBucket,
    confusionBucket,
    imageContext,
  });
  const cache = mode === 'brief' ? briefExplanationCache : fullExplanationCache;
  const modelConfig = getModeConfig(mode);
  const cacheEntryBefore = cache.getEntry(cacheKey);
  const cacheStatus = cacheEntryBefore ? (cacheEntryBefore.isStale ? 'stale' : 'hit') : 'miss';

  try {
    const result = await cache.getOrFetch(
      cacheKey,
      async () => {
        const bundle = await collectEvidenceBundle(correctTaxon, wrongTaxon, locale, { logger });
        let activeSources = bundle.sources;
        let sourceMap = buildSourceMap(activeSources);
        const bundleSummary = buildBundleSummary(bundle);
        const reasonCodes = [];
        let result = null;
        let parsed = null;
        let repaired = false;
        let rawText = null;
        let repairedText = null;
        let fullImagePart = null;
        let fullImageMeta = null;
        let photoSource = null;

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

        if (mode === 'full') {
          try {
            const imageAsset = await fetchImageInlinePart(imageContext, logger);
            fullImagePart = imageAsset.inline_data;
            fullImageMeta = imageAsset.meta;
            photoSource = buildRoundPhotoSource(imageContext);
            activeSources = photoSource ? [photoSource, ...bundle.sources] : bundle.sources;
            sourceMap = buildSourceMap(activeSources);
            logger?.info?.(
              {
                traceId,
                pairKey,
                mode,
                imageUrlHash: hashValue(imageContext?.url),
                imageFetchStatus: 'ok',
                imageInputBucket: fullImageMeta?.inputBucket || null,
                imageDimensions:
                  fullImageMeta?.width || fullImageMeta?.height
                    ? { width: fullImageMeta.width, height: fullImageMeta.height }
                    : null,
              },
              'Round photo fetched for full analysis'
            );
          } catch (imageError) {
            const imageReason = getImageReasonKey(imageError);
            reasonCodes.push(imageReason);
            logger?.warn?.(
              {
                traceId,
                pairKey,
                mode,
                imageUrlHash: imageContext?.url ? hashValue(imageContext.url) : null,
                imageFetchStatus: 'failed',
                error: imageError.message,
              },
              'Unable to fetch round photo for full analysis'
            );
            result = buildFullFallback(
              correctTaxon,
              wrongTaxon,
              locale,
              bundle,
              imageContext,
              [...reasonCodes, imageReason]
            );
          }
        }

        try {
          if (result) {
            return result;
          }
          rawText = await callGeminiWithRetry({
            model: modelConfig.model,
            timeoutMs: modelConfig.timeoutMs,
            maxAttempts: modelConfig.maxAttempts,
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
                    imageContext:
                      mode === 'full' && fullImagePart
                        ? {
                            ...fullImageMeta,
                            inlineDataPart: fullImagePart,
                            metaText:
                              "Photo jointe : analyse cette image precise du round. Si un detail n'est pas lisible, dis-le prudemment.",
                          }
                        : null,
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
              if (
                Number(bundle?.correct?.descriptionSources?.length || 0) === 0 ||
                Number(bundle?.wrong?.descriptionSources?.length || 0) === 0
              ) {
                reasonCodes.push('evidence_missing');
              }
              if (!support.minimumSupportMet) {
                reasonCodes.push('support_insufficient');
                logger?.warn?.(
                  {
                    traceId,
                    pairKey,
                    mode,
                    parsedPayload: shouldLogVerboseTraces ? parsed : undefined,
                    validationWarnings: validation.warnings,
                    support,
                  },
                  'Brief AI response rejected for insufficient support'
                );
              } else {
                const brief = {
                  ...validation.brief,
                  displayText:
                    validation.brief.displayText ||
                    composeBriefDisplayText({
                      ...validation.brief,
                      locale,
                      correctName: getDisplayName(correctTaxon),
                      wrongName: getDisplayName(wrongTaxon),
                    }),
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
              }
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
              const support = buildFullSupport(validation.full, bundle, sourceMap, {
                photoSourceId: photoSource?.id || null,
              });
              const confidence = support.level;
              if (
                Number(bundle?.correct?.descriptionSources?.length || 0) === 0 ||
                Number(bundle?.wrong?.descriptionSources?.length || 0) === 0
              ) {
                reasonCodes.push('evidence_missing');
              }
              if (!support.minimumSupportMet) {
                reasonCodes.push('support_insufficient');
                logger?.warn?.(
                  {
                    traceId,
                    pairKey,
                    mode,
                    parsedPayload: shouldLogVerboseTraces ? parsed : undefined,
                    validationWarnings: validation.warnings,
                    support,
                  },
                  'Full AI response rejected for insufficient support'
                );
              } else {
                const full = {
                  ...validation.full,
                  imageAnalysis: {
                    source: fullImageMeta?.source || 'round_photo',
                    downscaled: Boolean(fullImageMeta?.downscaled),
                    inputBucket: fullImageMeta?.inputBucket || '<=384-target',
                    imageAvailable: true,
                  },
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
                  sources: activeSources,
                  confidence,
                  fallback: false,
                  reasonCodes: dedupeReasonCodes(reasonCodes),
                  ...buildLegacyAliases({ brief: null, full }, locale, correctTaxon, wrongTaxon),
                };
              }
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
              : buildFullFallback(correctTaxon, wrongTaxon, locale, bundle, imageContext, reasonCodes);
          result.reasonCodes = dedupeReasonCodes([...reasonCodes, ...(result.reasonCodes || []), 'cached_fallback_prevented']);
        }

        if (repaired && result && !result.fallback) {
          result.reasonCodes = dedupeReasonCodes([...(result.reasonCodes || []), 'repair_used']);
        }

        return result;
      },
      {
        onError: (err) => logger?.error?.({ error: err.message }, 'Explanation cache error'),
        resolveEntryOptions: (value) => getCachePolicy(mode, value),
      }
    );

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
      : buildFullFallback(correctTaxon, wrongTaxon, locale, bundle, imageContext, [getReasonKeyFromError(error)]);
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

  if (!config.aiEnabled || !config.aiApiKey) {
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
          maxAttempts: MODEL_CONFIG.riddle.maxAttempts,
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
