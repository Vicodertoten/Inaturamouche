// server/services/questionGenerator.js
// Orchestration de la génération de questions de quiz

import { performance } from 'node:perf_hooks';
import { createSeededRandom, shuffleFisherYates } from '../../lib/quiz-utils.js';
import { getObservationPool } from './observationPool.js';
import {
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

const { questionQueueSize: QUESTION_QUEUE_SIZE } = config;

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
  logger,
  requestId,
  rng,
  poolRng,
  seed,
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
    excludeTaxaForTarget,
    targetTaxonId,
    selectionMode: initialSelectionMode,
  } = await mutex.runExclusive(async () => {
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
    const questionRng = hasSeed ? createSeededRandom(`${seed}|q|${questionIndex}`) : rng;
    const excludeTaxaForTarget = new Set();
    let targetTaxonId = nextEligibleTaxonId(cacheEntry, selectionState, Date.now(), excludeTaxaForTarget, questionRng, {
      seed: hasSeed ? seed : undefined,
      questionIndex,
    });

    let selectionMode = 'normal';
    if (!targetTaxonId) {
      targetTaxonId = pickRelaxedTaxon(cacheEntry, selectionState, excludeTaxaForTarget, questionRng);
      selectionMode = 'fallback_relax';
      logger?.info(
        {
          cacheKey,
          mode: selectionMode,
          pool: cacheEntry.taxonList.length,
          recentT: cacheEntry.recentTargetTaxa.length,
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

    return { selectionState, questionIndex, questionRng, excludeTaxaForTarget, targetTaxonId, selectionMode };
  });

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
  let correct_choice_index = -1;
  let correct_label = '';
  let choix_mode_facile = [];
  let choix_mode_facile_ids = [];
  let choix_mode_facile_correct_index = -1;

  const hasExplicitTaxa = Boolean(params?.taxon_id);
  const excludeFutureTargets = hasExplicitTaxa
    ? new Set((selectionState.taxonDeck || []).map((id) => String(id)))
    : null;

  if (!isTaxonomicMode) {
    const { lures, buckets: builtBuckets } = await buildLures(
      cacheEntry,
      selectionState,
      targetTaxonId,
      targetObservation,
      config.lureCount,
      questionRng,
      {
        allowExternalLures: hasExplicitTaxa,
        allowMixedIconic: hasExplicitTaxa,
        excludeTaxonIds: excludeFutureTargets,
        logger,
        requestId,
      }
    );
    if (!lures || lures.length < config.lureCount) {
      const err = new Error("Pas assez d'espèces différentes pour composer les choix.");
      err.status = 404;
      throw err;
    }
    buckets = builtBuckets;
    marks.builtLures = performance.now();

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
    correct_choice_index = shuffledChoices.findIndex((c) => c.taxon_id === String(targetTaxonId));
    try {
      correct_label = shuffledChoices[correct_choice_index]?.label || '';
    } catch {
      correct_label = '';
    }

    const facilePairs = choiceIdsInOrder.map((id) => ({
      taxon_id: id,
      label: getTaxonName(details.get(String(id))),
    }));
    const facileShuffled = shuffleFisherYates(facilePairs, questionRng);
    choix_mode_facile = facileShuffled.map((p) => p.label);
    choix_mode_facile_ids = facileShuffled.map((p) => p.taxon_id);
    choix_mode_facile_correct_index = choix_mode_facile_ids.findIndex((id) => id === String(targetTaxonId));
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
  if (!correct_label) {
    correct_label = getTaxonName(correct);
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
  await mutex.runExclusive(async () => {
    selectionState.questionIndex = questionIndex + 1;
    const stateKey = `${cacheKey}|${clientId || 'anon'}`;
    selectionStateCache.set(stateKey, selectionState);
  });

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

  return {
    payload: {
      image_urls,
      image_meta,
      sounds: isRiddleMode ? [] : targetObservation.sounds || [],
      game_mode: gameMode || 'easy',
      riddle: isRiddleMode && riddle ? { clues: riddle.clues, source: riddle.source } : null,
      bonne_reponse: {
        id: correct.id,
        name: correct.name,
        preferred_common_name: correct.preferred_common_name || correct.common_name || null,
        common_name: getTaxonName(correct),
        ancestors: Array.isArray(correct.ancestors) ? correct.ancestors : [],
        ancestor_ids: correct.ancestor_ids,
        iconic_taxon_id: correct.iconic_taxon_id,
        wikipedia_url: correct.wikipedia_url,
        url: correct.url, // Add iNaturalist URL
        default_photo: correct.default_photo, // Add default photo object
        observations_count: correct.observations_count ?? null,
        conservation_status: correct.conservation_status ?? null,
      },
      choices: shuffledChoices,
      correct_choice_index,
      correct_label,
      choice_taxa_details: choiceTaxaInfo.map(info => ({
        ...info, // Keep existing info (taxon_id, name, etc.)
        wikipedia_url: details.get(info.taxon_id)?.wikipedia_url,
        url: details.get(info.taxon_id)?.url,
        default_photo: details.get(info.taxon_id)?.default_photo,
        observations_count: details.get(info.taxon_id)?.observations_count ?? null,
        conservation_status: details.get(info.taxon_id)?.conservation_status ?? null,
      })),
      taxonomic_ascension: isTaxonomicMode
        ? {
            steps: taxonomicSteps,
            max_mistakes: taxonomicMeta?.maxMistakes || 0,
            hint_cost_xp: taxonomicMeta?.hintCost || 0,
            options_per_step: taxonomicMeta?.optionsPerStep || 0,
          }
        : null,
      choix_mode_facile,
      choix_mode_facile_ids,
      choix_mode_facile_correct_index,
      inaturalist_url: targetObservation.uri,
    },
    headers: {
      'X-Cache-Key': cacheKey,
      'X-Lures-Relaxed': selectionMode === 'fallback_relax' ? '1' : '0',
      'X-Lure-Buckets': `${buckets.near}|${buckets.mid}|${buckets.far}`,
      'X-Pool-Pages': String(pagesFetched),
      'X-Pool-Obs': String(poolObs),
      'X-Pool-Taxa': String(poolTaxa),
      'X-Selection-Geo': geoMode,
      'Server-Timing': serverTiming,
      'X-Timing': xTiming,
    },
  };
}
