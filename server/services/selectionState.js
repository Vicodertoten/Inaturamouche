// server/services/selectionState.js
// Gestion de l'état de sélection par client

import { config } from '../config/index.js';
import { selectionStateCache } from '../cache/selectionCache.js';
import { HistoryBuffer, createShuffledDeck, effectiveCooldownN } from '../../lib/quiz-utils.js';

const { cooldownTargetMs, cooldownTargetN, cooldownLureN, obsHistoryLimit, quizChoices } = config;
const COOLDOWN_TARGET_MS = cooldownTargetMs;
const COOLDOWN_TARGET_N = cooldownTargetN;
const COOLDOWN_LURE_N = cooldownLureN;
const OBS_HISTORY_LIMIT = obsHistoryLimit;
const QUIZ_CHOICES = quizChoices;

/**
 * Create a fresh selection state for a client.
 *
 * Includes: shuffled taxon deck, observation history buffer, target/lure
 * cooldown lists, and lure usage counter.
 *
 * @param {object} pool  Observation pool ({ taxonList, observationCount }).
 * @param {Function} rng Seeded random number generator.
 * @returns {object} Initial selection state.
 */
export function createSelectionState(pool, rng) {
  const historyLimit = Math.min(OBS_HISTORY_LIMIT, Math.max(0, (pool?.observationCount || 0) - 1));
  return {
    recentTargetTaxa: [],
    recentTargetSet: new Set(),
    recentLureTaxa: [],
    recentLureSet: new Set(),
    cooldownTarget: COOLDOWN_TARGET_MS ? new Map() : null,
    observationHistory: new HistoryBuffer(historyLimit),
    // Lure usage counter: Map<taxonId, number> — how many times each lure
    // has been shown. Used by buildLures() to weight selection and ensure
    // diversity without a fixed cooldown window.
    lureUsageCount: new Map(),
    taxonDeck: createShuffledDeck(pool.taxonList, rng),
    questionIndex: 0,
    version: pool.version,
  };
}

/**
 * Get or create the selection state for a specific client + cache key pair.
 *
 * Rehydrates observation history, migrates lure usage counts, and resets the
 * taxon deck when the pool version changes.
 *
 * @param {string} cacheKey  Pool cache key.
 * @param {string} clientId  Client identifier ('anon' if absent).
 * @param {object} pool      Observation pool.
 * @param {number} now       Current timestamp (ms).
 * @param {Function} rng     RNG for deck shuffling.
 * @returns {{ key: string, state: object }} Cache key and selection state.
 */
export function getSelectionStateForClient(cacheKey, clientId, pool, now, rng) {
  const key = `${cacheKey}|${clientId || 'anon'}`;
  let state = selectionStateCache.get(key);
  const historyLimit = Math.min(OBS_HISTORY_LIMIT, Math.max(0, (pool?.observationCount || 0) - 1));
  if (!state || !Array.isArray(state.taxonDeck) || state.version !== pool.version) {
    const previousHistory =
      state && state.observationHistory instanceof HistoryBuffer ? state.observationHistory : null;
    const previousQuestionIndex =
      state && Number.isInteger(state.questionIndex) && state.questionIndex >= 0 ? state.questionIndex : 0;
    const nextState = createSelectionState(pool, rng);
    nextState.questionIndex = previousQuestionIndex;
    if (previousHistory) {
      nextState.observationHistory = previousHistory;
      nextState.observationHistory.resize(historyLimit);
    }
    // Migrate lure usage counts across pool version changes
    if (state?.lureUsageCount instanceof Map) {
      nextState.lureUsageCount = state.lureUsageCount;
    }
    if (state?.recentTargetTaxa?.length && pool?.taxonSet) {
      nextState.recentTargetTaxa = state.recentTargetTaxa.filter((id) => pool.taxonSet.has(String(id)));
      nextState.recentTargetSet = new Set(nextState.recentTargetTaxa.map(String));
    }
    if (state?.recentLureTaxa?.length && pool?.taxonSet) {
      nextState.recentLureTaxa = state.recentLureTaxa.filter((id) => pool.taxonSet.has(String(id)));
      nextState.recentLureSet = new Set(nextState.recentLureTaxa.map(String));
    }
    state = nextState;
  }
  if (!(state.observationHistory instanceof HistoryBuffer)) {
    state.observationHistory = new HistoryBuffer(historyLimit);
  } else {
    state.observationHistory.resize(historyLimit);
  }
  // Ensure lureUsageCount is always a Map (guard for legacy states)
  if (!(state.lureUsageCount instanceof Map)) {
    state.lureUsageCount = new Map();
  }
  if (!Number.isInteger(state.questionIndex) || state.questionIndex < 0) {
    state.questionIndex = 0;
  }
  if (!Array.isArray(state.recentLureTaxa)) {
    state.recentLureTaxa = [];
  }
  if (!(state.recentLureSet instanceof Set)) {
    state.recentLureSet = new Set(state.recentLureTaxa.map(String));
  }
  state.version = pool.version;

  selectionStateCache.set(key, state);
  return { key, state };
}

/**
 * Record that an observation was shown to the user.
 *
 * @param {object} selectionState  Client selection state.
 * @param {string|number} obsId    Observation ID.
 */
export function rememberObservation(selectionState, obsId) {
  if (!selectionState?.observationHistory) return;
  selectionState.observationHistory.add(String(obsId));
}

/**
 * Check whether a taxon has at least one unseen observation.
 *
 * @param {object} pool            Observation pool.
 * @param {object} selectionState  Client selection state.
 * @param {string} taxonId         Taxon ID to check.
 * @returns {boolean}
 */
export function hasEligibleObservation(pool, selectionState, taxonId) {
  const list = pool.byTaxon.get(String(taxonId)) || [];
  if (!list.length) return false;
  if (!selectionState?.observationHistory) return true;
  return list.some((obs) => !selectionState.observationHistory.has(String(obs.id)));
}

/**
 * Pick a random unseen observation for a taxon.
 *
 * Falls back to seen observations when `allowSeen` is true.
 *
 * @param {object} pool            Observation pool.
 * @param {object} selectionState  Client selection state.
 * @param {string} taxonId         Taxon ID.
 * @param {object} [opts]
 * @param {boolean} [opts.allowSeen=false]  Allow previously seen observations.
 * @param {Function} [rng=Math.random]      RNG.
 * @returns {object|null} Observation or null.
 */
export function pickObservationForTaxon(pool, selectionState, taxonId, { allowSeen = false } = {}, rng = Math.random) {
  const list = pool.byTaxon.get(String(taxonId)) || [];
  if (list.length === 0) return null;
  const filtered =
    selectionState?.observationHistory && !allowSeen
      ? list.filter((o) => !selectionState.observationHistory.has(String(o.id)))
      : list.slice();
  if (!filtered.length) return null;
  const random = typeof rng === 'function' ? rng : Math.random;
  return filtered[Math.floor(random() * filtered.length)];
}

// Cooldown management
function purgeTTLMap(ttlMap, now) {
  if (!ttlMap) return;
  for (const [k, exp] of ttlMap.entries()) {
    if (exp <= now) ttlMap.delete(k);
  }
}

/**
 * Check if a taxon is currently blocked by the target cooldown.
 *
 * @param {object} selectionState  Client selection state.
 * @param {string} taxonId         Taxon ID.
 * @param {number} now             Current timestamp (ms).
 * @returns {boolean} True if blocked.
 */
export function isBlockedByTargetCooldown(selectionState, taxonId, now) {
  const id = String(taxonId);
  if (COOLDOWN_TARGET_MS && selectionState.cooldownTarget) {
    purgeTTLMap(selectionState.cooldownTarget, now);
    if (selectionState.cooldownTarget.has(id)) return true;
  }
  if (selectionState.recentTargetSet.has(id)) return true;
  return false;
}

/**
 * Push taxon IDs into the target cooldown (TTL-based or sliding window).
 *
 * @param {object} pool            Observation pool.
 * @param {object} selectionState  Client selection state.
 * @param {string[]} taxonIds      Taxon IDs to cool down.
 * @param {number} now             Current timestamp (ms).
 */
export function pushTargetCooldown(pool, selectionState, taxonIds, now) {
  const ids = taxonIds.map(String);
  if (COOLDOWN_TARGET_MS && selectionState.cooldownTarget) {
    const exp = now + COOLDOWN_TARGET_MS;
    for (const id of ids) selectionState.cooldownTarget.set(id, exp);
  } else {
    for (const id of ids) {
      if (!selectionState.recentTargetSet.has(id)) {
        selectionState.recentTargetTaxa.unshift(id);
        selectionState.recentTargetSet.add(id);
      }
    }
    const limit = effectiveCooldownN(COOLDOWN_TARGET_N, pool.taxonList.length, QUIZ_CHOICES);
    while (selectionState.recentTargetTaxa.length > limit) {
      const removed = selectionState.recentTargetTaxa.pop();
      selectionState.recentTargetSet.delete(removed);
    }
  }
}

/**
 * Build the set of taxon IDs currently excluded from lure selection.
 *
 * @param {object} pool            Observation pool.
 * @param {object} selectionState  Client selection state.
 * @returns {Set<string>} Excluded taxon IDs.
 */
export function buildLureCooldownExclusionSet(pool, selectionState) {
  if (!selectionState) return new Set();
  const limit = effectiveCooldownN(COOLDOWN_LURE_N, pool?.taxonList?.length || 0, QUIZ_CHOICES);
  if (limit <= 0) return new Set();
  if (!Array.isArray(selectionState.recentLureTaxa)) selectionState.recentLureTaxa = [];
  if (!(selectionState.recentLureSet instanceof Set)) {
    selectionState.recentLureSet = new Set(selectionState.recentLureTaxa.map(String));
  }

  const poolSet = pool?.taxonSet instanceof Set ? pool.taxonSet : null;
  if (poolSet) {
    selectionState.recentLureTaxa = selectionState.recentLureTaxa.filter((id) => poolSet.has(String(id)));
    selectionState.recentLureSet = new Set(selectionState.recentLureTaxa.map(String));
  }
  while (selectionState.recentLureTaxa.length > limit) {
    const removed = selectionState.recentLureTaxa.pop();
    selectionState.recentLureSet.delete(String(removed));
  }
  return new Set(selectionState.recentLureTaxa.map(String));
}

/**
 * Push taxon IDs into the lure cooldown sliding window.
 *
 * @param {object} pool            Observation pool.
 * @param {object} selectionState  Client selection state.
 * @param {string[]} taxonIds      Lure taxon IDs to cool down.
 */
export function pushLureCooldown(pool, selectionState, taxonIds) {
  if (!selectionState) return;
  const limit = effectiveCooldownN(COOLDOWN_LURE_N, pool?.taxonList?.length || 0, QUIZ_CHOICES);
  if (limit <= 0) {
    selectionState.recentLureTaxa = [];
    selectionState.recentLureSet = new Set();
    return;
  }
  if (!Array.isArray(selectionState.recentLureTaxa)) selectionState.recentLureTaxa = [];
  if (!(selectionState.recentLureSet instanceof Set)) {
    selectionState.recentLureSet = new Set(selectionState.recentLureTaxa.map(String));
  }

  for (const rawId of taxonIds || []) {
    const id = String(rawId);
    if (!id) continue;
    if (selectionState.recentLureSet.has(id)) continue;
    selectionState.recentLureTaxa.unshift(id);
    selectionState.recentLureSet.add(id);
  }
  while (selectionState.recentLureTaxa.length > limit) {
    const removed = selectionState.recentLureTaxa.pop();
    selectionState.recentLureSet.delete(String(removed));
  }
}
