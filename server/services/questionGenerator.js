// server/services/questionGenerator.js
// Orchestration de la génération de questions de quiz

import { performance } from 'node:perf_hooks';
import { createSeededRandom, shuffleFisherYates } from '../../lib/quiz-utils.js';
import { getObservationPool } from './observationPool.js';
import {
  createSelectionState,
  getSelectionStateForClient,
  rememberObservation,
  pickObservationForTaxon,
  pushTargetCooldown,
} from './selectionState.js';
import { buildLures } from './lureBuilder.js';
import { getFullTaxaDetails, getTaxonName } from './iNaturalistClient.js';
import { buildTaxonomicAscension } from './taxonomicAscension.js';
import { selectionStateCache, getOrCreateMutex, questionQueueCache } from '../cache/selectionCache.js';
import taxonDetailsCache from '../cache/taxonDetailsCache.js';
import { nextEligibleTaxonId, pickRelaxedTaxon, makeChoiceLabels, buildTimingData } from '../utils/helpers.js';
import { config } from '../config/index.js';
import { generateRiddle } from './aiService.js';
import { SCORE_PER_RANK, HARD_BASE_POINTS } from '../../shared/scoring.js';

const { questionQueueSize: QUESTION_QUEUE_SIZE } = config;
const { quizChoices: QUIZ_CHOICES } = config;
const HARD_DEFAULT_MAX_GUESSES = 3;
const TAXONOMIC_DEFAULT_MAX_HINTS = 1;
const MAX_LURE_CLOSENESS = 0.98;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildIconicRotationExclusionSet(cacheEntry, avoidIconicTaxonId) {
  if (!cacheEntry || !Array.isArray(cacheEntry.taxonList) || !avoidIconicTaxonId) return new Set();
  const avoidId = String(avoidIconicTaxonId);
  const excluded = new Set();
  for (const taxonId of cacheEntry.taxonList) {
    const obs = cacheEntry.byTaxon.get(String(taxonId))?.[0];
    const iconic = obs?.taxon?.iconic_taxon_id;
    if (iconic == null) continue;
    if (String(iconic) === avoidId) excluded.add(String(taxonId));
  }
  return excluded;
}

export function buildUniqueEasyChoicePairs(detailsMap, ids) {
  const seen = new Set();

  return ids.map((id) => {
    const idStr = String(id);
    const detail = detailsMap.get(idStr) || {};
    const common = getTaxonName(detail);
    const scientific = String(detail?.name || '').trim();
    const baseLabel = String(common || scientific || `Taxon ${idStr}`).trim();

    let label = baseLabel;
    const normalizedBase = label.toLowerCase();
    if (seen.has(normalizedBase)) {
      label = scientific && scientific.toLowerCase() !== normalizedBase
        ? `${baseLabel} (${scientific})`
        : `${baseLabel} [#${idStr}]`;
    }

    let normalized = label.toLowerCase();
    let suffix = 2;
    while (seen.has(normalized)) {
      label = `${baseLabel} [#${idStr}-${suffix}]`;
      normalized = label.toLowerCase();
      suffix += 1;
    }

    seen.add(normalized);
    return { taxon_id: idStr, label };
  });
}

function assertStrictChoiceContract({
  shuffledChoices,
  choiceIdsInOrder,
  labelsInOrder,
  targetTaxonId,
  easyChoiceIds,
  easyLabels,
}) {
  if (!Array.isArray(shuffledChoices) || shuffledChoices.length !== QUIZ_CHOICES) {
    const err = new Error('Contrat invalide: nombre de choix incorrect.');
    err.status = 503;
    err.code = 'INVALID_QUESTION_CONTRACT';
    throw err;
  }

  const shuffledTaxonIds = shuffledChoices.map((choice) => String(choice?.taxon_id || ''));
  const uniqueShuffledTaxa = new Set(shuffledTaxonIds);
  if (uniqueShuffledTaxa.size !== shuffledChoices.length || shuffledTaxonIds.some((id) => id.length === 0)) {
    const err = new Error('Contrat invalide: doublons taxonomiques dans les choix.');
    err.status = 503;
    err.code = 'INVALID_QUESTION_CONTRACT';
    throw err;
  }

  const normalizedLabels = shuffledChoices.map((choice) => String(choice?.label || '').trim().toLowerCase());
  const uniqueLabels = new Set(normalizedLabels);
  if (uniqueLabels.size !== shuffledChoices.length || normalizedLabels.some((label) => label.length === 0)) {
    const err = new Error('Contrat invalide: labels de choix non uniques.');
    err.status = 503;
    err.code = 'INVALID_QUESTION_CONTRACT';
    throw err;
  }

  const correctCount = shuffledTaxonIds.filter((id) => id === String(targetTaxonId)).length;
  if (correctCount !== 1) {
    const err = new Error('Contrat invalide: réponse correcte absente ou dupliquée.');
    err.status = 503;
    err.code = 'INVALID_QUESTION_CONTRACT';
    throw err;
  }

  if (Array.isArray(choiceIdsInOrder) && choiceIdsInOrder.length !== QUIZ_CHOICES) {
    const err = new Error('Contrat invalide: ordre initial des choix incomplet.');
    err.status = 503;
    err.code = 'INVALID_QUESTION_CONTRACT';
    throw err;
  }
  if (Array.isArray(choiceIdsInOrder)) {
    const normalizedChoiceIds = choiceIdsInOrder.map((id) => String(id || ''));
    const uniqueChoiceIds = new Set(normalizedChoiceIds);
    if (uniqueChoiceIds.size !== choiceIdsInOrder.length || normalizedChoiceIds.some((id) => id.length === 0)) {
      const err = new Error('Contrat invalide: IDs de choix initiaux non uniques.');
      err.status = 503;
      err.code = 'INVALID_QUESTION_CONTRACT';
      throw err;
    }
  }

  if (Array.isArray(labelsInOrder) && labelsInOrder.length !== QUIZ_CHOICES) {
    const err = new Error('Contrat invalide: labels initiaux incomplets.');
    err.status = 503;
    err.code = 'INVALID_QUESTION_CONTRACT';
    throw err;
  }
  if (Array.isArray(labelsInOrder)) {
    const normalizedInitialLabels = labelsInOrder.map((label) => String(label || '').trim().toLowerCase());
    const uniqueInitialLabels = new Set(normalizedInitialLabels);
    if (
      uniqueInitialLabels.size !== labelsInOrder.length ||
      normalizedInitialLabels.some((label) => label.length === 0)
    ) {
      const err = new Error('Contrat invalide: labels initiaux non uniques.');
      err.status = 503;
      err.code = 'INVALID_QUESTION_CONTRACT';
      throw err;
    }
  }

  if (Array.isArray(easyChoiceIds) && easyChoiceIds.length !== QUIZ_CHOICES) {
    const err = new Error('Contrat invalide: mode facile incomplet.');
    err.status = 503;
    err.code = 'INVALID_QUESTION_CONTRACT';
    throw err;
  }
  if (Array.isArray(easyChoiceIds)) {
    const normalizedEasyIds = easyChoiceIds.map((id) => String(id || ''));
    const uniqueEasyIds = new Set(normalizedEasyIds);
    if (uniqueEasyIds.size !== easyChoiceIds.length || normalizedEasyIds.some((id) => id.length === 0)) {
      const err = new Error('Contrat invalide: IDs mode facile non uniques.');
      err.status = 503;
      err.code = 'INVALID_QUESTION_CONTRACT';
      throw err;
    }
    if (Array.isArray(choiceIdsInOrder)) {
      const initialIds = new Set(choiceIdsInOrder.map((id) => String(id || '')));
      const mismatch = normalizedEasyIds.some((id) => !initialIds.has(id));
      if (mismatch || initialIds.size !== uniqueEasyIds.size) {
        const err = new Error('Contrat invalide: incohérence entre les IDs de choix.');
        err.status = 503;
        err.code = 'INVALID_QUESTION_CONTRACT';
        throw err;
      }
    }
  }
  if (Array.isArray(easyLabels) && easyLabels.length !== QUIZ_CHOICES) {
    const err = new Error('Contrat invalide: labels mode facile incomplets.');
    err.status = 503;
    err.code = 'INVALID_QUESTION_CONTRACT';
    throw err;
  }
  if (Array.isArray(easyLabels)) {
    const normalizedEasyLabels = easyLabels.map((label) => String(label || '').trim().toLowerCase());
    const uniqueEasyLabels = new Set(normalizedEasyLabels);
    if (uniqueEasyLabels.size !== easyLabels.length || normalizedEasyLabels.some((label) => label.length === 0)) {
      const err = new Error('Contrat invalide: labels mode facile non uniques.');
      err.status = 503;
      err.code = 'INVALID_QUESTION_CONTRACT';
      throw err;
    }
  }
}

/**
 * Get or create queue entry for question pre-generation
 */
export function getQueueEntry(queueKey) {
  let entry = questionQueueCache.get(queueKey);
  if (!entry || !Array.isArray(entry.queue)) {
    entry = { queue: [], inFlight: null, lastFailureAt: 0 };
  }
  questionQueueCache.set(queueKey, entry);
  return entry;
}

/**
 * Fill question queue with pre-generated questions
 */
export async function fillQuestionQueue(entry, context) {
  if (entry.inFlight) return entry.inFlight;
  entry.inFlight = (async () => {
    while (entry.queue.length < QUESTION_QUEUE_SIZE) {
      try {
        const item = await buildQuizQuestion(context);
        if (item?.payload) {
          entry.queue.push(item);
        } else {
          break;
        }
      } catch (err) {
        entry.lastFailureAt = Date.now();
        break;
      }
    }
  })().finally(() => {
    entry.inFlight = null;
  });
  return entry.inFlight;
}

/**
 * Build a complete quiz question with all choices and metadata
 */
export async function buildQuizQuestion({
  params,
  cacheKey,
  monthDayFilter,
  locale,
  gameMode,
  geoMode,
  clientId,
  hasPackFilter,
  adaptiveTuning,
  logger,
  requestId,
  rng,
  poolRng,
  seed,
  clientQuestionIndex,
}) {
  const marks = {};
  marks.start = performance.now();

  const hasSeed = typeof seed === 'string' && seed.length > 0;

  const { pool: cacheEntry, pagesFetched, poolObs, poolTaxa } = await getObservationPool({
    cacheKey,
    params,
    monthDayFilter,
    logger,
    requestId,
    rng: poolRng,
    seed: hasSeed ? seed : undefined,
  });

  marks.fetchedObs = performance.now();
  marks.builtIndex = marks.fetchedObs;

  // MUTEX-PROTECTED: Accès à selectionStateCache
  const stateKey = `${cacheKey}|${clientId || 'anon'}`;
  const mutex = getOrCreateMutex(stateKey);

  const {
    selectionState,
    questionIndex,
    questionRng,
    targetTaxonId,
    selectionMode: initialSelectionMode,
  } = await (hasSeed
    // ── Seeded games (daily challenge): fully deterministic, no shared state ──
    // Create a fresh ephemeral selectionState for each request so that
    // different users never interfere with each other's question generation.
    ? (async () => {
        const questionIndex = Number.isInteger(clientQuestionIndex) ? clientQuestionIndex : 0;
        const questionRng = createSeededRandom(`${seed}|q|${questionIndex}`);
        // Fresh ephemeral state — not cached, not shared
        const selectionState = createSelectionState(cacheEntry, rng);
        const targetTaxonId = nextEligibleTaxonId(cacheEntry, selectionState, Date.now(), new Set(), questionRng, {
          seed,
          questionIndex,
        });
        if (!targetTaxonId) {
          const err = new Error("Pool d'observations indisponible, réessayez.");
          err.status = 503;
          throw err;
        }
        return { selectionState, questionIndex, questionRng, targetTaxonId, selectionMode: 'seeded' };
      })()
    // ── Normal games: persistent per-client state ──
    : mutex.runExclusive(async () => {
        const { state: selectionState, key } = getSelectionStateForClient(
          cacheKey,
          clientId,
          cacheEntry,
          Date.now(),
          rng
        );

        const questionIndex =
          Number.isInteger(selectionState.questionIndex) && selectionState.questionIndex >= 0
            ? selectionState.questionIndex
            : 0;
        const questionRng = rng;
        const now = Date.now();
        const iconicRotationExclusions = buildIconicRotationExclusionSet(
          cacheEntry,
          adaptiveTuning?.avoidIconicTaxonId
        );
        const excludeTaxaForTarget = new Set(iconicRotationExclusions);
        let targetTaxonId = nextEligibleTaxonId(cacheEntry, selectionState, now, excludeTaxaForTarget, questionRng, {
          seed: undefined,
          questionIndex,
        });

        let selectionMode = 'normal';
        if (!targetTaxonId && excludeTaxaForTarget.size > 0) {
          excludeTaxaForTarget.clear();
          targetTaxonId = nextEligibleTaxonId(cacheEntry, selectionState, now, excludeTaxaForTarget, questionRng, {
            seed: undefined,
            questionIndex,
          });
          if (targetTaxonId) {
            selectionMode = 'adaptive_rotation_relaxed';
          }
        }
        if (targetTaxonId && iconicRotationExclusions.size > 0 && selectionMode === 'normal') {
          selectionMode = 'adaptive_rotation';
        }
        if (!targetTaxonId) {
          targetTaxonId = pickRelaxedTaxon(cacheEntry, selectionState, excludeTaxaForTarget, questionRng);
          selectionMode = 'fallback_relax';
          logger?.info(
            {
              cacheKey,
              mode: selectionMode,
              pool: cacheEntry.taxonList.length,
              recentT: selectionState?.recentTargetTaxa?.length || 0,
            },
            'Target fallback relax engaged'
          );
        }
        if (!targetTaxonId) {
          const err = new Error("Pool d'observations indisponible, réessayez.");
          err.status = 503;
          throw err;
        }

        // Sauvegarder le state DANS le mutex avant de le retourner
        selectionStateCache.set(key, selectionState);

        return { selectionState, questionIndex, questionRng, targetTaxonId, selectionMode };
      })
  );

  const selectionMode = initialSelectionMode;
  const isFirstQuestion = questionIndex === 0;

  let targetObservation = pickObservationForTaxon(cacheEntry, selectionState, targetTaxonId, { allowSeen: false }, questionRng);
  if (!targetObservation) {
    targetObservation = pickObservationForTaxon(cacheEntry, selectionState, targetTaxonId, { allowSeen: true }, questionRng);
  }
  if (!targetObservation) {
    const err = new Error('Aucune observation exploitable trouvée pour le taxon cible.');
    err.status = 503;
    throw err;
  }
  rememberObservation(selectionState, targetObservation.id);
  marks.pickedTarget = performance.now();
  const isTaxonomicMode = gameMode === 'taxonomic';
  let buckets = { near: 0, mid: 0, far: 0 };
  let taxonomicSteps = null;
  let taxonomicMeta = null;
  let details = new Map();
  let choiceTaxaInfo = [];
  let choiceIdsInOrder = [];
  let labelsInOrder = [];
  let choiceObjects = [];
  let shuffledChoices = [];
  let choix_mode_facile = [];
  let choix_mode_facile_ids = [];

  const hasExplicitTaxa = Boolean(params?.taxon_id);
  // Only exclude a small window of upcoming targets from lures to avoid
  // "spoiling" future questions.  For small pools (e.g. list packs like
  // mushrooms with ≤49 taxa) excluding the entire deck would starve the
  // lure builder of candidates.
  const excludeFutureTargets = (() => {
    if (!hasExplicitTaxa) return null;
    const deck = selectionState.taxonDeck || [];
    if (deck.length === 0) return null;
    const poolSize = cacheEntry.taxonList?.length || 0;
    // Keep at least quizChoices taxa available for lures + target.
    const maxExclude = Math.max(0, poolSize - config.quizChoices - 1);
    if (maxExclude === 0) return null;
    const windowSize = Math.min(deck.length, maxExclude, config.questionQueueSize);
    return new Set(deck.slice(-windowSize).map((id) => String(id)));
  })();

  if (!isTaxonomicMode) {
    const adaptiveLureDelta = Number(adaptiveTuning?.lureClosenessDelta) || 0;
    const modeMinCloseness =
      clamp(
        (gameMode === 'easy'
        ? config.easyLureMinCloseness
        : gameMode === 'riddle'
          ? config.riddleLureMinCloseness
          : config.hardLureMinCloseness) + adaptiveLureDelta,
        0,
        MAX_LURE_CLOSENESS
      );

    // buildLures is now synchronous — it reads from the pre-computed
    // confusion map (built once at pool construction time).
    let { lures } = buildLures(
      cacheEntry,
      selectionState,
      targetTaxonId,
      targetObservation,
      config.lureCount,
      questionRng,
      {
        excludeTaxonIds: excludeFutureTargets,
        minCloseness: modeMinCloseness,
        lureUsageCount: selectionState.lureUsageCount || null,
      }
    );

    // Retry with relaxed closeness if lures are insufficient.
    if ((!lures || lures.length < config.lureCount) && modeMinCloseness > 0) {
      logger?.info(
        {
          requestId,
          targetTaxonId: String(targetTaxonId),
          luresFound: lures?.length || 0,
          lureCount: config.lureCount,
          modeMinCloseness,
        },
        'Lure closeness too strict, retrying with minCloseness=0'
      );
      ({ lures } = buildLures(
        cacheEntry,
        selectionState,
        targetTaxonId,
        targetObservation,
        config.lureCount,
        questionRng,
        {
          excludeTaxonIds: null,
          minCloseness: 0,
          lureUsageCount: null,
        }
      ));
    }

    if (!lures || lures.length < config.lureCount) {
      const err = new Error("Pas assez d'espèces différentes pour composer les choix.");
      err.status = 404;
      throw err;
    }
    marks.builtLures = performance.now();

    // Increment lure usage counters for diversity weighting.
    // The counter persists across questions so that lures used more often
    // get progressively lower weight in future selections.
    if (selectionState.lureUsageCount) {
      for (const lure of lures) {
        const tid = String(lure.taxonId);
        selectionState.lureUsageCount.set(tid, (selectionState.lureUsageCount.get(tid) || 0) + 1);
      }
    }

    choiceIdsInOrder = [String(targetTaxonId), ...lures.map((l) => String(l.taxonId))];
    const fallbackDetails = new Map();
    fallbackDetails.set(String(targetTaxonId), targetObservation?.taxon || {});
    for (const lure of lures) {
      fallbackDetails.set(String(lure.taxonId), lure.obs?.taxon || {});
    }

  const choiceTaxaDetails = await getFullTaxaDetails(
    choiceIdsInOrder,
    locale,
    {
      logger,
      requestId,
      fallbackDetails,
      // Fast path for the very first question: use fallback details, refresh cache in background.
      allowPartial: isFirstQuestion,
    },
    taxonDetailsCache
  );

    details = new Map();
    for (const taxon of choiceTaxaDetails) {
      details.set(String(taxon.id), taxon);
    }
    for (const id of choiceIdsInOrder) {
      const key = String(id);
      if (!details.has(key)) {
        details.set(key, fallbackDetails.get(key) || {});
      }
    }

    choiceTaxaInfo = choiceIdsInOrder.map((id) => {
      const info = details.get(String(id)) || {};
      return {
        taxon_id: String(id),
        name: info.name || info.taxon?.name,
        preferred_common_name: info.preferred_common_name || info.common_name || null,
        rank: info.rank,
      };
    });

    labelsInOrder = makeChoiceLabels(details, choiceIdsInOrder);
    choiceObjects = choiceIdsInOrder.map((id, idx) => ({ taxon_id: id, label: labelsInOrder[idx] }));
    shuffledChoices = shuffleFisherYates(choiceObjects, questionRng);

    const facilePairs = buildUniqueEasyChoicePairs(details, choiceIdsInOrder);
    const facileShuffled = shuffleFisherYates(facilePairs, questionRng);
    choix_mode_facile = facileShuffled.map((p) => p.label);
    choix_mode_facile_ids = facileShuffled.map((p) => p.taxon_id);
  } else {
    const ascensionData = await buildTaxonomicAscension({
      pool: cacheEntry,
      targetTaxonId,
      locale,
      rng: questionRng,
      logger,
      requestId,
      taxonDetailsCache,
    });
    taxonomicSteps = ascensionData.steps;
    taxonomicMeta = ascensionData.meta;
    details = ascensionData.detailMap;
    buckets = { near: 0, mid: 0, far: 0 };
    marks.builtLures = performance.now();
  }
  const correct = details.get(String(targetTaxonId));
  if (!correct) {
    const err = new Error(`Impossible de récupérer les détails du taxon ${targetTaxonId}`);
    err.status = 502;
    throw err;
  }
  marks.taxaFetched = performance.now();

  const isRiddleMode = gameMode === 'riddle';
  let riddle = null;
  if (isRiddleMode) {
    riddle = await generateRiddle(correct, locale, logger);
  }
  marks.labelsMade = performance.now();

  const observationPhotos = !isRiddleMode && Array.isArray(targetObservation.photos) ? targetObservation.photos : [];
  // Medium (~500px) pour chargement rapide mobile au lieu de large (~1024px)
  const image_urls = observationPhotos
    .map((p) => (p?.url ? p.url.replace('square', 'medium') : null))
    .filter(Boolean);
  const image_meta = observationPhotos.map((p, idx) => ({
    id: p.id ?? idx,
    attribution: p.attribution,
    license_code: p.license_code,
    url: p.url,
    original_dimensions: p.original_dimensions,
  }));

  pushTargetCooldown(cacheEntry, selectionState, [String(targetTaxonId)], Date.now());

  marks.end = performance.now();

  // MUTEX-PROTECTED: Mise à jour de questionIndex
  // For seeded games, the question index comes from the client, so we don't
  // increment the shared state — it would cause race conditions between users.
  if (!hasSeed) {
    await mutex.runExclusive(async () => {
      selectionState.questionIndex = questionIndex + 1;
      const stateKey = `${cacheKey}|${clientId || 'anon'}`;
      selectionStateCache.set(stateKey, selectionState);
    });
  }

  const { timing, serverTiming, xTiming } = buildTimingData(marks, { pagesFetched, poolObs, poolTaxa });

  logger?.info(
    {
      cacheKey,
      selectionMode,
      pagesFetched,
      poolObs,
      poolTaxa,
      timings: timing,
      targetTaxonId: String(targetTaxonId),
      targetObsId: String(targetObservation.id),
    },
    'Quiz timings'
  );

  const answerPayload = {
    id: correct.id,
    name: correct.name,
    preferred_common_name: correct.preferred_common_name || correct.common_name || null,
    common_name: getTaxonName(correct),
    ancestors: Array.isArray(correct.ancestors) ? correct.ancestors : [],
    ancestor_ids: correct.ancestor_ids,
    iconic_taxon_id: correct.iconic_taxon_id,
    wikipedia_url: correct.wikipedia_url,
    url: correct.url,
    default_photo: correct.default_photo,
    observations_count: correct.observations_count ?? null,
    conservation_status: correct.conservation_status ?? null,
  };

  if (!isTaxonomicMode) {
    assertStrictChoiceContract({
      shuffledChoices,
      choiceIdsInOrder,
      labelsInOrder,
      targetTaxonId,
      easyChoiceIds: choix_mode_facile_ids,
      easyLabels: choix_mode_facile,
    });
  }

  const payload = {
    image_urls,
    image_meta,
    sounds: isRiddleMode ? [] : targetObservation.sounds || [],
    game_mode: gameMode || 'easy',
    riddle: isRiddleMode && riddle ? { clues: riddle.clues, source: riddle.source } : null,
    choices: shuffledChoices,
    choice_taxa_details: choiceTaxaInfo.map((info) => ({
      ...info,
      wikipedia_url: details.get(info.taxon_id)?.wikipedia_url,
      url: details.get(info.taxon_id)?.url,
      default_photo: details.get(info.taxon_id)?.default_photo,
      observations_count: details.get(info.taxon_id)?.observations_count ?? null,
      conservation_status: details.get(info.taxon_id)?.conservation_status ?? null,
    })),
    taxonomic_ascension: isTaxonomicMode
      ? {
          steps: (taxonomicSteps || []).map((step) => ({
            rank: step.rank,
            parent: step.parent,
            options: step.options,
          })),
          max_mistakes: taxonomicMeta?.maxMistakes || 0,
          hint_cost_xp: taxonomicMeta?.hintCost || 0,
          options_per_step: taxonomicMeta?.optionsPerStep || 0,
          max_hints: TAXONOMIC_DEFAULT_MAX_HINTS,
        }
      : null,
    hard_mode:
      gameMode === 'hard'
        ? {
            max_guesses: HARD_DEFAULT_MAX_GUESSES,
            base_points: HARD_BASE_POINTS,
          }
        : null,
    choix_mode_facile,
    choix_mode_facile_ids,
    inaturalist_url: targetObservation.uri,
  };

  return {
    payload,
    validation: {
      game_mode: gameMode || 'easy',
      locale: locale || 'fr',
      correct_taxon_id: String(targetTaxonId),
      correct_answer: answerPayload,
      inaturalist_url: targetObservation.uri,
      max_attempts: gameMode === 'riddle' ? 3 : 1,
      hard_mode:
        gameMode === 'hard'
          ? {
              max_guesses: HARD_DEFAULT_MAX_GUESSES,
              base_points: HARD_BASE_POINTS,
            }
          : null,
      taxonomic_mode: isTaxonomicMode
        ? {
            max_mistakes: taxonomicMeta?.maxMistakes || 0,
            max_hints: TAXONOMIC_DEFAULT_MAX_HINTS,
            score_per_rank: SCORE_PER_RANK,
            steps: (taxonomicSteps || []).map((step) => ({
              rank: step.rank,
              correct_taxon_id: String(step.correct_taxon_id),
              option_taxon_ids: (step.options || []).map((opt) => String(opt.taxon_id)),
            })),
          }
        : null,
    },
    headers: {
      'X-Cache-Key': cacheKey,
      'X-Lures-Relaxed': selectionMode === 'fallback_relax' ? '1' : '0',
      'X-Lure-Buckets': `${buckets.near}|${buckets.mid}|${buckets.far}`,
      'X-Pool-Pages': String(pagesFetched),
      'X-Pool-Obs': String(poolObs),
      'X-Pool-Taxa': String(poolTaxa),
      'X-Selection-Geo': geoMode,
      'X-Adaptive-Band': String(adaptiveTuning?.difficultyBand || 'normal'),
      'X-Adaptive-Samples': String(adaptiveTuning?.sampleSize || 0),
      'X-Adaptive-Accuracy': adaptiveTuning?.accuracyLastN == null ? '' : String(adaptiveTuning.accuracyLastN),
      'X-Target-Selection-Mode': selectionMode,
      'Server-Timing': serverTiming,
      'X-Timing': xTiming,
    },
  };
}
