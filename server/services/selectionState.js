// server/services/selectionState.js
// Gestion de l'état de sélection par client

import { config } from '../config/index.js';
import { selectionStateCache } from '../cache/selectionCache.js';
import { HistoryBuffer, createShuffledDeck, effectiveCooldownN } from '../../lib/quiz-utils.js';

const { cooldownTargetMs, cooldownTargetN, obsHistoryLimit, quizChoices } = config;
const COOLDOWN_TARGET_MS = cooldownTargetMs;
const COOLDOWN_TARGET_N = cooldownTargetN;
const OBS_HISTORY_LIMIT = obsHistoryLimit;
const QUIZ_CHOICES = quizChoices;

/**
 * Create initial selection state for a client
 */
export function createSelectionState(pool, rng) {
  const historyLimit = Math.min(OBS_HISTORY_LIMIT, Math.max(0, (pool?.observationCount || 0) - 1));
  return {
    recentTargetTaxa: [],
    recentTargetSet: new Set(),
    cooldownTarget: COOLDOWN_TARGET_MS ? new Map() : null,
    observationHistory: new HistoryBuffer(historyLimit),
    taxonDeck: createShuffledDeck(pool.taxonList, rng),
    questionIndex: 0,
    version: pool.version,
  };
}

/**
 * Get or create selection state for a client
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
    if (state?.recentTargetTaxa?.length && pool?.taxonSet) {
      nextState.recentTargetTaxa = state.recentTargetTaxa.filter((id) => pool.taxonSet.has(String(id)));
      nextState.recentTargetSet = new Set(nextState.recentTargetTaxa.map(String));
    }
    state = nextState;
  }
  if (!(state.observationHistory instanceof HistoryBuffer)) {
    state.observationHistory = new HistoryBuffer(historyLimit);
  } else {
    state.observationHistory.resize(historyLimit);
  }
  if (!Number.isInteger(state.questionIndex) || state.questionIndex < 0) {
    state.questionIndex = 0;
  }
  state.version = pool.version;

  selectionStateCache.set(key, state);
  return { key, state };
}

/**
 * Remember that an observation was used
 */
export function rememberObservation(selectionState, obsId) {
  if (!selectionState?.observationHistory) return;
  selectionState.observationHistory.add(String(obsId));
}

/**
 * Check if a taxon has eligible observations (not yet seen)
 */
export function hasEligibleObservation(pool, selectionState, taxonId) {
  const list = pool.byTaxon.get(String(taxonId)) || [];
  if (!list.length) return false;
  if (!selectionState?.observationHistory) return true;
  return list.some((obs) => !selectionState.observationHistory.has(String(obs.id)));
}

/**
 * Pick an observation for a taxon
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

export function isBlockedByTargetCooldown(selectionState, taxonId, now) {
  const id = String(taxonId);
  if (COOLDOWN_TARGET_MS && selectionState.cooldownTarget) {
    purgeTTLMap(selectionState.cooldownTarget, now);
    if (selectionState.cooldownTarget.has(id)) return true;
  }
  if (selectionState.recentTargetSet.has(id)) return true;
  return false;
}

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
