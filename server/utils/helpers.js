// server/utils/helpers.js
// Fonctions utilitaires diverses

import { performance } from 'node:perf_hooks';
import { createShuffledDeck, drawFromDeck } from '../../lib/quiz-utils.js';
import {
  hasEligibleObservation,
  isBlockedByTargetCooldown,
  pickObservationForTaxon,
} from '../services/selectionState.js';
import { getTaxonName } from '../services/iNaturalistClient.js';
import { shuffleFisherYates } from '../../lib/quiz-utils.js';

/**
 * Récupérer l'IP du client en tenant compte des proxies
 */
export function getClientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    ''
  );
}

/**
 * Validation de date ISO
 */
export function isValidISODate(s) {
  return typeof s === 'string' && !Number.isNaN(Date.parse(s));
}

/**
 * Normaliser une date en mois/jour
 */
export function normalizeMonthDay(dateString) {
  if (!isValidISODate(dateString)) return null;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return null;
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Construire un filtre mois/jour pour une période
 */
export function buildMonthDayFilter(d1, d2) {
  const start = normalizeMonthDay(d1);
  const end = normalizeMonthDay(d2);
  if (!start && !end) return null;

  const startVal = start ? start.month * 100 + start.day : null;
  const endVal = end ? end.month * 100 + end.day : null;
  const wrapsYear = startVal != null && endVal != null && startVal > endVal;

  const months = new Set();
  const addMonthRange = (from, to) => {
    let m = from;
    while (true) {
      months.add(m);
      if (m === to) break;
      m = (m % 12) + 1;
    }
  };

  if (start && end) {
    addMonthRange(start.month, end.month);
  } else if (start) {
    addMonthRange(start.month, 12);
  } else if (end) {
    addMonthRange(1, end.month);
  }

  const predicate = (md) => {
    if (!md?.month || !md?.day) return false;
    const value = md.month * 100 + md.day;
    if (startVal != null && endVal != null) {
      return wrapsYear ? value >= startVal || value <= endVal : value >= startVal && value <= endVal;
    }
    if (startVal != null) return value >= startVal;
    return value <= endVal;
  };

  return { predicate, months: Array.from(months) };
}

/**
 * Extraire les paramètres géographiques
 */
export function geoParams(q) {
  const p = {};
  if (q.place_id) {
    const raw = Array.isArray(q.place_id) ? q.place_id.join(',') : String(q.place_id);
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length) return { p: { place_id: list.join(',') }, mode: 'place_id' };
  }
  const hasBbox = [q.nelat, q.nelng, q.swlat, q.swlng].every((v) => v != null);
  if (hasBbox)
    return {
      p: { nelat: q.nelat, nelng: q.nelng, swlat: q.swlat, swlng: q.swlng },
      mode: 'bbox',
    };
  return { p: {}, mode: 'global' };
}

/**
 * Normaliser une liste d'IDs (string ou array)
 */
export function normalizeIdList(input) {
  if (!input) return [];
  if (Array.isArray(input))
    return input
      .map((v) => String(v))
      .map((v) => v.trim())
      .filter(Boolean);
  return String(input)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Select next eligible taxon using shuffle-with-cursor
 */
export function nextEligibleTaxonId(
  pool,
  selectionState,
  now,
  excludeSet = new Set(),
  rng = Math.random,
  { seed, questionIndex } = {}
) {
  if (seed && pool.taxonList?.length > 0) {
    const index = questionIndex % pool.taxonList.length;
    const taxonId = pool.taxonList[index];
    return String(taxonId);
  }

  if (!Array.isArray(selectionState.taxonDeck) || selectionState.taxonDeck.length === 0) {
    selectionState.taxonDeck = createShuffledDeck(pool.taxonList, rng);
  }
  const maxAttempts = pool.taxonList.length;
  if (maxAttempts === 0) return null;

  const isEligible = (tid) => {
    const key = String(tid);
    if (excludeSet.has(key)) return false;
    if (!pool.byTaxon.get(key)?.length) return false;
    if (!hasEligibleObservation(pool, selectionState, key)) return false;
    if (isBlockedByTargetCooldown(selectionState, key, now)) return false;
    return true;
  };

  let attempts = 0;
  while (attempts < maxAttempts) {
    if (!selectionState.taxonDeck.length) {
      selectionState.taxonDeck = createShuffledDeck(pool.taxonList, rng);
    }
    const tid = drawFromDeck(selectionState.taxonDeck, rng);
    if (tid == null) return null;
    if (isEligible(tid)) return String(tid);
    attempts += 1;
  }
  return null;
}

/**
 * Fallback relax (pondéré par ancienneté) — cible
 */
export function pickRelaxedTaxon(pool, selectionState, excludeSet = new Set(), rng = Math.random) {
  const all = pool.taxonList.filter(
    (t) =>
      !excludeSet.has(String(t)) &&
      pool.byTaxon.get(String(t))?.length &&
      hasEligibleObservation(pool, selectionState, String(t))
  );
  if (all.length === 0) return null;
  const random = typeof rng === 'function' ? rng : Math.random;

  const weightFor = (id) => {
    const s = String(id);
    const idxT = selectionState.recentTargetTaxa.indexOf(s);
    if (idxT === -1) return 5;
    const lenT = selectionState.recentTargetTaxa.length;
    return Math.max(1, lenT - idxT);
  };

  const weights = all.map(weightFor);
  const total = weights.reduce((a, b) => a + b, 0) || all.length;
  let r = random() * total;
  for (let i = 0; i < all.length; i++) {
    r -= weights[i];
    if (r <= 0) return String(all[i]);
  }
  return String(all[all.length - 1]);
}

/**
 * Make unique choice labels for non-easy mode
 */
export function makeChoiceLabels(detailsMap, ids) {
  const base = ids.map((id) => {
    const d = detailsMap.get(String(id));
    const common = getTaxonName(d);
    const sci = d?.name || 'sp.';
    return `${common} (${sci})`;
  });
  const seen = new Map();
  return base.map((label, i) => {
    if (!seen.has(label)) {
      seen.set(label, 1);
      return label;
    }
    const id = String(ids[i]);
    const newLabel = `${label} [#${id}]`;
    seen.set(newLabel, 1);
    return newLabel;
  });
}

/**
 * Build timing data for observability
 */
export function buildTimingData(marks, extra = {}) {
  const ms = (a, b) => Math.max(0, Math.round((marks[b] - marks[a]) || 0));
  const total = Math.max(0, Math.round((marks.end - marks.start) || 0));
  const timing = {
    fetchObsMs: ms('start', 'fetchedObs'),
    buildIndexMs: ms('fetchedObs', 'builtIndex'),
    pickTargetMs: ms('builtIndex', 'pickedTarget'),
    buildLuresMs: ms('pickedTarget', 'builtLures'),
    taxaDetailsMs: ms('builtLures', 'taxaFetched'),
    labelsMs: ms('taxaFetched', 'labelsMade'),
    totalMs: total,
    ...extra,
  };
  const serverTiming =
    `fetchObs;dur=${timing.fetchObsMs}, ` +
    `buildIndex;dur=${timing.buildIndexMs}, ` +
    `pickTarget;dur=${timing.pickTargetMs}, ` +
    `buildLures;dur=${timing.buildLuresMs}, ` +
    `taxa;dur=${timing.taxaDetailsMs}, ` +
    `labels;dur=${timing.labelsMs}, ` +
    `total;dur=${timing.totalMs}`;
  return { timing, serverTiming, xTiming: JSON.stringify(timing) };
}

export function setTimingHeaders(res, marks, extra = {}) {
  const { timing, serverTiming, xTiming } = buildTimingData(marks, extra);
  res.set('X-Timing', xTiming);
  res.set('Server-Timing', serverTiming);
  return timing;
}
