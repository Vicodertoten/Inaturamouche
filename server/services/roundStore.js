// server/services/roundStore.js
// In-memory signed round store (HMAC + TTL + anti double-submit)

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { SmartCache } from '../../lib/smart-cache.js';
import { config } from '../config/index.js';
import { getFullTaxaDetails } from './iNaturalistClient.js';
import taxonDetailsCache from '../cache/taxonDetailsCache.js';

const {
  roundStateTtl: ROUND_STATE_TTL_MS,
  roundHmacSecret,
  maxSelectionStates,
  adaptivePerformanceWindow,
  adaptiveMinSamples,
  adaptiveHarderAccuracy,
  adaptiveEasierAccuracy,
  adaptiveLureDelta,
  iconicRotationWindow,
  iconicRotationDominance,
  balanceDashboardEventLimit,
} = config;

const roundCache = new SmartCache({
  max: Math.max(200, (maxSelectionStates || 200) * 5),
  ttl: ROUND_STATE_TTL_MS,
});

const submissionDedupCache = new SmartCache({
  max: Math.max(500, (maxSelectionStates || 200) * 10),
  ttl: ROUND_STATE_TTL_MS,
});

const clientAdaptiveCache = new SmartCache({
  max: Math.max(500, (maxSelectionStates || 200) * 10),
  ttl: ROUND_STATE_TTL_MS * 6,
});

const balanceEvents = [];

const DEFAULT_DEV_SECRET = 'dev-round-secret-change-me';
const RANK_ORDER = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const DEFAULT_HARD_MAX_GUESSES = 3;
const DEFAULT_HARD_MAX_HINTS = 1;
const DEFAULT_TAXONOMIC_MAX_MISTAKES = 2;
const DEFAULT_TAXONOMIC_MAX_HINTS = 1;
const DEFAULT_SCORE_PER_RANK = Object.freeze({
  kingdom: 5,
  phylum: 10,
  class: 15,
  order: 20,
  family: 25,
  genus: 30,
  species: 40,
});
const GAME_MODES = ['easy', 'riddle', 'hard', 'taxonomic'];

function getAdaptiveProfile(clientId) {
  const key = String(clientId || 'anon');
  const existing = clientAdaptiveCache.get(key);
  if (existing && typeof existing === 'object') return existing;
  const initial = {
    byMode: {
      easy: [],
      riddle: [],
      hard: [],
      taxonomic: [],
    },
    recentIconicTaxa: [],
    recentTaxa: [],
    updatedAt: Date.now(),
  };
  clientAdaptiveCache.set(key, initial);
  return initial;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function computeAccuracy(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const wins = history.reduce((sum, value) => sum + (value === true ? 1 : 0), 0);
  return wins / history.length;
}

function pushLimited(arr, value, max) {
  arr.push(value);
  while (arr.length > max) {
    arr.shift();
  }
}

function pushBalanceEvent(event) {
  balanceEvents.push(event);
  while (balanceEvents.length > balanceDashboardEventLimit) {
    balanceEvents.shift();
  }
}

function extractHintCountFromResult(result) {
  if (Number.isFinite(result?.hard_state?.hint_count)) return Number(result.hard_state.hint_count);
  if (Number.isFinite(result?.taxonomic_state?.hint_count)) return Number(result.taxonomic_state.hint_count);
  return 0;
}

function trackRoundOutcome(round, result) {
  if (!result?.round_consumed) return;
  const mode = GAME_MODES.includes(round?.gameMode) ? round.gameMode : 'easy';
  const clientId = String(round?.clientId || 'anon');
  const profile = getAdaptiveProfile(clientId);
  const modeHistory = Array.isArray(profile.byMode?.[mode]) ? profile.byMode[mode] : [];
  const isWin = result?.status === 'win';

  pushLimited(modeHistory, isWin, adaptivePerformanceWindow);
  profile.byMode[mode] = modeHistory;

  const correctTaxonId = round?.correctTaxonId ? String(round.correctTaxonId) : null;
  if (correctTaxonId) {
    pushLimited(profile.recentTaxa, correctTaxonId, Math.max(adaptivePerformanceWindow * 2, 20));
  }
  const iconicTaxonId = round?.correctAnswer?.iconic_taxon_id;
  if (Number.isFinite(Number(iconicTaxonId))) {
    pushLimited(profile.recentIconicTaxa, String(iconicTaxonId), Math.max(iconicRotationWindow * 2, 12));
  }
  profile.updatedAt = Date.now();
  clientAdaptiveCache.set(clientId, profile);

  pushBalanceEvent({
    ts: Date.now(),
    mode,
    status: result.status,
    isCorrect: isWin,
    hintsUsed: extractHintCountFromResult(result),
    iconicTaxonId: round?.correctAnswer?.iconic_taxon_id ?? null,
  });
}

function computeDominantIconicId(recentIconicTaxa) {
  if (!Array.isArray(recentIconicTaxa) || recentIconicTaxa.length === 0) return null;
  const window = recentIconicTaxa.slice(-iconicRotationWindow);
  if (window.length < 3) return null;
  const counts = new Map();
  for (const iconicId of window) {
    counts.set(iconicId, (counts.get(iconicId) || 0) + 1);
  }
  let bestId = null;
  let bestCount = 0;
  for (const [iconicId, count] of counts.entries()) {
    if (count > bestCount) {
      bestId = iconicId;
      bestCount = count;
    }
  }
  if (!bestId) return null;
  const dominance = bestCount / window.length;
  if (dominance < iconicRotationDominance) return null;
  return bestId;
}

export function getAdaptiveQuestionTuning({ clientId, gameMode } = {}) {
  const safeMode = GAME_MODES.includes(String(gameMode || '')) ? String(gameMode) : 'easy';
  const profile = getAdaptiveProfile(clientId);
  const history = Array.isArray(profile.byMode?.[safeMode]) ? profile.byMode[safeMode] : [];
  const sample = history.slice(-adaptivePerformanceWindow);
  const sampleSize = sample.length;
  const accuracyLastN = computeAccuracy(sample);
  let lureClosenessDelta = 0;
  let difficultyBand = 'normal';

  if (sampleSize >= adaptiveMinSamples && accuracyLastN != null) {
    if (accuracyLastN >= adaptiveHarderAccuracy) {
      lureClosenessDelta = adaptiveLureDelta;
      difficultyBand = 'harder';
    } else if (accuracyLastN <= adaptiveEasierAccuracy) {
      lureClosenessDelta = -adaptiveLureDelta;
      difficultyBand = 'easier';
    }
  }

  const avoidIconicTaxonId = computeDominantIconicId(profile.recentIconicTaxa);
  return {
    sampleSize,
    accuracyLastN: accuracyLastN == null ? null : clamp01(accuracyLastN),
    difficultyBand,
    lureClosenessDelta,
    avoidIconicTaxonId,
  };
}

export function getBalanceDashboardSnapshot() {
  const events = balanceEvents.slice();
  const summary = {
    generated_at: new Date().toISOString(),
    events_window: events.length,
    total_rounds: events.length,
    global_accuracy: 0,
    by_mode: {},
    status_distribution: {},
    iconic_distribution: {},
  };

  if (events.length === 0) {
    for (const mode of GAME_MODES) {
      summary.by_mode[mode] = { rounds: 0, win_rate: 0, avg_hints: 0 };
    }
    return summary;
  }

  let globalWins = 0;
  const byModeCounts = new Map();
  const byModeWins = new Map();
  const byModeHints = new Map();
  const statusCounts = new Map();
  const iconicCounts = new Map();

  for (const event of events) {
    const mode = GAME_MODES.includes(event.mode) ? event.mode : 'easy';
    const isCorrect = event.isCorrect === true;
    const hints = Math.max(0, Number(event.hintsUsed) || 0);
    if (isCorrect) globalWins += 1;

    byModeCounts.set(mode, (byModeCounts.get(mode) || 0) + 1);
    byModeWins.set(mode, (byModeWins.get(mode) || 0) + (isCorrect ? 1 : 0));
    byModeHints.set(mode, (byModeHints.get(mode) || 0) + hints);

    const statusKey = String(event.status || 'unknown');
    statusCounts.set(statusKey, (statusCounts.get(statusKey) || 0) + 1);

    if (event.iconicTaxonId != null) {
      const iconicKey = String(event.iconicTaxonId);
      iconicCounts.set(iconicKey, (iconicCounts.get(iconicKey) || 0) + 1);
    }
  }

  summary.global_accuracy = clamp01(globalWins / events.length);
  for (const mode of GAME_MODES) {
    const rounds = byModeCounts.get(mode) || 0;
    const wins = byModeWins.get(mode) || 0;
    const hintsTotal = byModeHints.get(mode) || 0;
    summary.by_mode[mode] = {
      rounds,
      win_rate: rounds > 0 ? clamp01(wins / rounds) : 0,
      avg_hints: rounds > 0 ? Number((hintsTotal / rounds).toFixed(3)) : 0,
    };
  }
  summary.status_distribution = Object.fromEntries(statusCounts.entries());
  summary.iconic_distribution = Object.fromEntries(iconicCounts.entries());
  return summary;
}

export function __resetRoundStoreForTests() {
  roundCache.clear();
  submissionDedupCache.clear();
  clientAdaptiveCache.clear();
  balanceEvents.length = 0;
}

const resolveSigningSecret = () =>
  roundHmacSecret && String(roundHmacSecret).trim().length > 0
    ? String(roundHmacSecret)
    : DEFAULT_DEV_SECRET;

const createSignaturePayload = ({ roundId, clientId, expiresAt, nonce }) =>
  `${String(roundId)}|${String(clientId || 'anon')}|${String(expiresAt)}|${String(nonce)}`;

const signRound = ({ roundId, clientId, expiresAt, nonce }) => {
  const payload = createSignaturePayload({ roundId, clientId, expiresAt, nonce });
  return createHmac('sha256', resolveSigningSecret()).update(payload).digest('hex');
};

const HEX_RE = /^[0-9a-f]+$/i;

const safeEqualHex = (a, b) => {
  try {
    const leftHex = String(a || '');
    const rightHex = String(b || '');
    if (!HEX_RE.test(leftHex) || !HEX_RE.test(rightHex)) return false;
    if (leftHex.length % 2 !== 0 || rightHex.length % 2 !== 0) return false;

    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');
    if (left.length === 0 || right.length === 0) return false;
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
};

const normalizeRank = (value) => (typeof value === 'string' ? value.toLowerCase() : '');

const normalizeScorePerRank = (raw) => {
  const out = { ...DEFAULT_SCORE_PER_RANK };
  if (!raw || typeof raw !== 'object') return out;
  for (const rank of RANK_ORDER) {
    const parsed = Number.parseInt(String(raw[rank]), 10);
    if (Number.isFinite(parsed) && parsed >= 0) out[rank] = parsed;
  }
  return out;
};

const snapshotTaxon = (taxon) => {
  if (!taxon?.id) return null;
  return {
    id: String(taxon.id),
    name: taxon.name || null,
    preferred_common_name: taxon.preferred_common_name || taxon.common_name || null,
    rank: taxon.rank || null,
    wikipedia_url: taxon.wikipedia_url || null,
    url: taxon.url || null,
    default_photo: taxon.default_photo || null,
    ancestors: Array.isArray(taxon.ancestors)
      ? taxon.ancestors
          .filter((ancestor) => ancestor?.id && ancestor?.rank)
          .map((ancestor) => ({
            id: String(ancestor.id),
            name: ancestor.name || null,
            preferred_common_name: ancestor.preferred_common_name || ancestor.common_name || null,
            rank: ancestor.rank,
          }))
      : [],
  };
};

const buildHardTargetLineage = (correctAnswer) => {
  const lineage = {};
  if (!correctAnswer) return lineage;

  if (Array.isArray(correctAnswer.ancestors)) {
    for (const ancestor of correctAnswer.ancestors) {
      const rank = normalizeRank(ancestor?.rank);
      if (!rank || !RANK_ORDER.includes(rank)) continue;
      const snap = snapshotTaxon(ancestor);
      if (snap) lineage[rank] = snap;
    }
  }

  const speciesSnap = snapshotTaxon({ ...correctAnswer, rank: 'species' });
  if (speciesSnap) {
    speciesSnap.ancestors = Array.isArray(correctAnswer.ancestors) ? speciesSnap.ancestors : [];
    lineage.species = speciesSnap;
  }

  return lineage;
};

const computePointsFromKnownRanks = (knownTaxa, scorePerRank) =>
  RANK_ORDER.reduce((sum, rank) => {
    if (!knownTaxa?.[rank]) return sum;
    return sum + (scorePerRank?.[rank] || 0);
  }, 0);

const toPublicKnownTaxa = (knownTaxa) => {
  const out = {};
  for (const rank of RANK_ORDER) {
    if (knownTaxa?.[rank]) out[rank] = knownTaxa[rank];
  }
  return out;
};

const toRoundPublicResult = (result) => {
  const revealSolution = Boolean(result.round_consumed || result.is_correct);
  const payload = {
    status: result.status,
    is_correct: Boolean(result.is_correct),
    correct_taxon_id: revealSolution ? result.correct_taxon_id : null,
    correct_answer: revealSolution ? result.correct_answer : null,
    inaturalist_url: revealSolution ? (result.inaturalist_url || null) : null,
    attempts_used: result.attempts_used ?? 0,
    attempts_remaining: result.attempts_remaining ?? 0,
    round_consumed: Boolean(result.round_consumed),
  };

  if (result.hard_state) payload.hard_state = result.hard_state;
  if (result.taxonomic_state) payload.taxonomic_state = result.taxonomic_state;
  if (result.selected_taxon) payload.selected_taxon = result.selected_taxon;
  if (result.guess_outcome) payload.guess_outcome = result.guess_outcome;

  return payload;
};

const makeBaseRoundResult = (round, status, { attemptsUsed = 0, attemptsRemaining = 0, roundConsumed = false } = {}) => ({
  status,
  is_correct: status === 'win',
  correct_taxon_id: String(round.correctTaxonId),
  correct_answer: round.correctAnswer,
  inaturalist_url: round.inaturalistUrl,
  attempts_used: attemptsUsed,
  attempts_remaining: attemptsRemaining,
  round_consumed: roundConsumed,
});

export function createRoundSession({
  clientId,
  gameMode,
  correctTaxonId,
  correctAnswer,
  inaturalistUrl,
  maxAttempts = 1,
  locale = 'fr',
  hardMode,
  taxonomicMode,
}) {
  const roundId = randomUUID();
  const nonce = randomUUID();
  const expiresAt = Date.now() + ROUND_STATE_TTL_MS;

  const normalizedGameMode = String(gameMode || 'easy');
  const round = {
    roundId,
    clientId: String(clientId || 'anon'),
    locale: String(locale || 'fr'),
    gameMode: normalizedGameMode,
    correctTaxonId: String(correctTaxonId),
    correctAnswer: correctAnswer || null,
    inaturalistUrl: inaturalistUrl || null,
    expiresAt,
    nonce,
    finalized: false,
    attemptsUsed: 0,
    maxAttempts: Math.max(1, Number(maxAttempts) || 1),
    hardState: null,
    taxonomicState: null,
    lastResult: null,
    createdAt: Date.now(),
  };

  if (normalizedGameMode === 'hard') {
    round.hardState = {
      maxGuesses: Math.max(1, Number(hardMode?.max_guesses) || DEFAULT_HARD_MAX_GUESSES),
      guessesUsed: 0,
      maxHints: Math.max(0, Number(hardMode?.max_hints) || DEFAULT_HARD_MAX_HINTS),
      hintCount: 0,
      scorePerRank: normalizeScorePerRank(hardMode?.score_per_rank),
      targetLineage: buildHardTargetLineage(correctAnswer),
      knownTaxa: {},
      pointsEarned: 0,
    };
  }

  if (normalizedGameMode === 'taxonomic') {
    const rawSteps = Array.isArray(taxonomicMode?.steps) ? taxonomicMode.steps : [];
    round.taxonomicState = {
      steps: rawSteps.map((step) => ({
        rank: normalizeRank(step?.rank),
        correctTaxonId: String(step?.correct_taxon_id || ''),
        optionTaxonIds: Array.isArray(step?.option_taxon_ids)
          ? step.option_taxon_ids.map((id) => String(id))
          : [],
      })),
      currentStepIndex: 0,
      maxMistakes: Math.max(1, Number(taxonomicMode?.max_mistakes) || DEFAULT_TAXONOMIC_MAX_MISTAKES),
      mistakes: 0,
      maxHints: Math.max(0, Number(taxonomicMode?.max_hints) || DEFAULT_TAXONOMIC_MAX_HINTS),
      hintCount: 0,
      scorePerRank: normalizeScorePerRank(taxonomicMode?.score_per_rank),
      pointsEarned: 0,
      stepHistory: [],
    };
  }

  roundCache.set(roundId, round);
  const signature = signRound({
    roundId,
    clientId: round.clientId,
    expiresAt,
    nonce,
  });

  return {
    round_id: roundId,
    round_signature: signature,
    round_expires_at: expiresAt,
  };
}

function verifyRoundSignature(round, roundSignature, clientId) {
  const expected = signRound({
    roundId: round.roundId,
    clientId: round.clientId,
    expiresAt: round.expiresAt,
    nonce: round.nonce,
  });

  if (!safeEqualHex(expected, roundSignature)) return false;
  if (String(clientId || 'anon') !== String(round.clientId || 'anon')) return false;
  return true;
}

function getRound(roundId) {
  const round = roundCache.get(String(roundId));
  if (!round) {
    const err = new Error('Round not found or expired.');
    err.status = 410;
    err.code = 'ROUND_EXPIRED';
    throw err;
  }
  if (Date.now() > round.expiresAt) {
    roundCache.delete(String(roundId));
    const err = new Error('Round expired.');
    err.status = 410;
    err.code = 'ROUND_EXPIRED';
    throw err;
  }
  return round;
}

function resolveRoundAction(gameMode, requestedAction) {
  if (requestedAction) return String(requestedAction);
  if (gameMode === 'hard') return 'hard_guess';
  if (gameMode === 'taxonomic') return 'taxonomic_select';
  return 'answer';
}

function assertSelectedTaxon(selectedTaxonId) {
  const selected = String(selectedTaxonId || '');
  if (!selected) {
    const err = new Error('Selected taxon is required.');
    err.status = 400;
    err.code = 'BAD_REQUEST';
    throw err;
  }
  return selected;
}

async function fetchSelectedTaxonDetail(selectedTaxonId, locale, logger, requestId) {
  const details = await getFullTaxaDetails(
    [selectedTaxonId],
    locale,
    { logger, requestId, fallbackDetails: new Map() },
    taxonDetailsCache
  );
  const detail = Array.isArray(details) ? details[0] : null;
  if (!detail?.id) {
    const err = new Error('Selected taxon not found.');
    err.status = 404;
    err.code = 'TAXON_NOT_FOUND';
    throw err;
  }
  return detail;
}

function resolveHardHintRank(hardState) {
  return RANK_ORDER.find((rank) => hardState?.targetLineage?.[rank] && !hardState?.knownTaxa?.[rank]) || null;
}

async function processHardGuess(round, selectedTaxonId, { logger, requestId } = {}) {
  const hardState = round.hardState;
  if (!hardState) {
    const err = new Error('Hard mode state unavailable.');
    err.status = 500;
    err.code = 'ROUND_STATE_INVALID';
    throw err;
  }

  const selectedDetail = await fetchSelectedTaxonDetail(selectedTaxonId, round.locale, logger, requestId);
  const selectedTaxon = snapshotTaxon(selectedDetail);
  const selectedLineage = [
    ...(Array.isArray(selectedDetail.ancestors) ? selectedDetail.ancestors : []),
    selectedDetail,
  ];

  const gainedRanks = [];
  let touchedKnownLineage = false;

  for (const taxon of selectedLineage) {
    const rank = normalizeRank(taxon?.rank);
    if (!rank || !RANK_ORDER.includes(rank)) continue;
    const target = hardState.targetLineage[rank];
    if (!target) continue;
    if (String(target.id) !== String(taxon.id)) continue;
    touchedKnownLineage = true;
    if (!hardState.knownTaxa[rank]) {
      hardState.knownTaxa[rank] = target;
      gainedRanks.push(rank);
    }
  }

  hardState.guessesUsed += 1;
  const guessesRemaining = Math.max(0, hardState.maxGuesses - hardState.guessesUsed);
  hardState.pointsEarned = computePointsFromKnownRanks(hardState.knownTaxa, hardState.scorePerRank);

  const speciesGuessed = Boolean(hardState.knownTaxa?.species);
  const roundConsumed = speciesGuessed || guessesRemaining <= 0;
  const status = roundConsumed ? (speciesGuessed ? 'win' : 'lose') : 'playing';
  if (roundConsumed) round.finalized = true;

  return {
    ...makeBaseRoundResult(round, status, {
      attemptsUsed: hardState.guessesUsed,
      attemptsRemaining: guessesRemaining,
      roundConsumed,
    }),
    selected_taxon: selectedTaxon,
    guess_outcome: gainedRanks.length > 0 ? 'progress' : touchedKnownLineage ? 'redundant' : 'wrong',
    hard_state: {
      known_taxa: toPublicKnownTaxa(hardState.knownTaxa),
      gained_ranks: gainedRanks,
      guesses_used: hardState.guessesUsed,
      guesses_remaining: guessesRemaining,
      max_guesses: hardState.maxGuesses,
      hint_count: hardState.hintCount,
      max_hints: hardState.maxHints,
      points_earned: hardState.pointsEarned,
    },
  };
}

function processHardHint(round) {
  const hardState = round.hardState;
  if (!hardState) {
    const err = new Error('Hard mode state unavailable.');
    err.status = 500;
    err.code = 'ROUND_STATE_INVALID';
    throw err;
  }

  if (hardState.hintCount >= hardState.maxHints) {
    const err = new Error('Hint limit reached for this round.');
    err.status = 409;
    err.code = 'HARD_HINT_LIMIT';
    throw err;
  }

  const rank = resolveHardHintRank(hardState);
  if (!rank) {
    const guessesRemaining = Math.max(0, hardState.maxGuesses - hardState.guessesUsed);
    return {
      ...makeBaseRoundResult(round, 'playing', {
        attemptsUsed: hardState.guessesUsed,
        attemptsRemaining: guessesRemaining,
        roundConsumed: false,
      }),
      guess_outcome: 'hint_none',
      hard_state: {
        known_taxa: toPublicKnownTaxa(hardState.knownTaxa),
        gained_ranks: [],
        guesses_used: hardState.guessesUsed,
        guesses_remaining: guessesRemaining,
        max_guesses: hardState.maxGuesses,
        hint_count: hardState.hintCount,
        max_hints: hardState.maxHints,
        points_earned: hardState.pointsEarned,
        hint_revealed_rank: null,
      },
    };
  }

  hardState.hintCount += 1;
  hardState.knownTaxa[rank] = hardState.targetLineage[rank];
  hardState.pointsEarned = computePointsFromKnownRanks(hardState.knownTaxa, hardState.scorePerRank);

  const speciesGuessed = Boolean(hardState.knownTaxa?.species);
  const guessesRemaining = Math.max(0, hardState.maxGuesses - hardState.guessesUsed);
  const roundConsumed = speciesGuessed;
  const status = roundConsumed ? 'win' : 'playing';
  if (roundConsumed) round.finalized = true;

  return {
    ...makeBaseRoundResult(round, status, {
      attemptsUsed: hardState.guessesUsed,
      attemptsRemaining: guessesRemaining,
      roundConsumed,
    }),
    guess_outcome: 'hint',
    hard_state: {
      known_taxa: toPublicKnownTaxa(hardState.knownTaxa),
      gained_ranks: [rank],
      guesses_used: hardState.guessesUsed,
      guesses_remaining: guessesRemaining,
      max_guesses: hardState.maxGuesses,
      hint_count: hardState.hintCount,
      max_hints: hardState.maxHints,
      points_earned: hardState.pointsEarned,
      hint_revealed_rank: rank,
    },
  };
}

function getTaxonomicStep(round, stepIndex) {
  const state = round.taxonomicState;
  if (!state) {
    const err = new Error('Taxonomic mode state unavailable.');
    err.status = 500;
    err.code = 'ROUND_STATE_INVALID';
    throw err;
  }
  if (!Number.isInteger(stepIndex) || stepIndex < 0) {
    const err = new Error('Invalid step index.');
    err.status = 400;
    err.code = 'INVALID_STEP_INDEX';
    throw err;
  }
  if (stepIndex !== state.currentStepIndex) {
    const err = new Error('Step index is out of sync with server state.');
    err.status = 409;
    err.code = 'STEP_OUT_OF_SYNC';
    throw err;
  }
  const step = state.steps[stepIndex];
  if (!step || !step.correctTaxonId) {
    const err = new Error('Step unavailable.');
    err.status = 410;
    err.code = 'STEP_UNAVAILABLE';
    throw err;
  }
  return step;
}

function buildTaxonomicStatePayload(round, {
  answeredStepIndex,
  stepWasCorrect,
  stepCorrectTaxonId,
  selectedTaxonId,
  viaHint = false,
} = {}) {
  const state = round.taxonomicState;
  return {
    current_step_index: state.currentStepIndex,
    max_mistakes: state.maxMistakes,
    mistakes: state.mistakes,
    hint_count: state.hintCount,
    max_hints: state.maxHints,
    points_earned: state.pointsEarned,
    answered_step_index: Number.isInteger(answeredStepIndex) ? answeredStepIndex : null,
    step_was_correct: typeof stepWasCorrect === 'boolean' ? stepWasCorrect : null,
    step_correct_taxon_id: stepCorrectTaxonId ? String(stepCorrectTaxonId) : null,
    selected_taxon_id: selectedTaxonId ? String(selectedTaxonId) : null,
    via_hint: Boolean(viaHint),
  };
}

function processTaxonomicSelect(round, selectedTaxonId, stepIndex) {
  const state = round.taxonomicState;
  const step = getTaxonomicStep(round, stepIndex);
  const selected = assertSelectedTaxon(selectedTaxonId);

  if (Array.isArray(step.optionTaxonIds) && step.optionTaxonIds.length > 0 && !step.optionTaxonIds.includes(selected)) {
    const err = new Error('Selected option does not belong to current step.');
    err.status = 400;
    err.code = 'INVALID_STEP_OPTION';
    throw err;
  }

  const isCorrectStep = selected === step.correctTaxonId;
  if (isCorrectStep) {
    state.pointsEarned += state.scorePerRank?.[step.rank] || 0;
  } else {
    state.mistakes += 1;
  }

  state.stepHistory[stepIndex] = {
    wasCorrect: isCorrectStep,
    viaHint: false,
    selectedTaxonId: selected,
    correctTaxonId: step.correctTaxonId,
  };

  const isLastStep = stepIndex >= state.steps.length - 1;
  const outOfLives = state.mistakes >= state.maxMistakes;
  const roundConsumed = outOfLives || isLastStep;

  let status = 'playing';
  if (outOfLives) {
    status = 'lose';
    round.finalized = true;
  } else if (isLastStep) {
    status = 'win';
    round.finalized = true;
  } else {
    state.currentStepIndex += 1;
  }

  return {
    ...makeBaseRoundResult(round, status, {
      attemptsUsed: stepIndex + 1,
      attemptsRemaining: Math.max(0, state.maxMistakes - state.mistakes),
      roundConsumed,
    }),
    taxonomic_state: buildTaxonomicStatePayload(round, {
      answeredStepIndex: stepIndex,
      stepWasCorrect: isCorrectStep,
      stepCorrectTaxonId: step.correctTaxonId,
      selectedTaxonId: selected,
      viaHint: false,
    }),
  };
}

function processTaxonomicHint(round, stepIndex) {
  const state = round.taxonomicState;
  const step = getTaxonomicStep(round, stepIndex);

  if (state.hintCount >= state.maxHints) {
    const err = new Error('Hint limit reached for this round.');
    err.status = 409;
    err.code = 'TAXONOMIC_HINT_LIMIT';
    throw err;
  }

  state.hintCount += 1;
  state.pointsEarned += state.scorePerRank?.[step.rank] || 0;
  state.stepHistory[stepIndex] = {
    wasCorrect: true,
    viaHint: true,
    selectedTaxonId: step.correctTaxonId,
    correctTaxonId: step.correctTaxonId,
  };

  const isLastStep = stepIndex >= state.steps.length - 1;
  const roundConsumed = isLastStep;

  let status = 'playing';
  if (isLastStep) {
    status = 'win';
    round.finalized = true;
  } else {
    state.currentStepIndex += 1;
  }

  return {
    ...makeBaseRoundResult(round, status, {
      attemptsUsed: stepIndex + 1,
      attemptsRemaining: Math.max(0, state.maxMistakes - state.mistakes),
      roundConsumed,
    }),
    taxonomic_state: buildTaxonomicStatePayload(round, {
      answeredStepIndex: stepIndex,
      stepWasCorrect: true,
      stepCorrectTaxonId: step.correctTaxonId,
      selectedTaxonId: step.correctTaxonId,
      viaHint: true,
    }),
  };
}

function processEasyOrRiddleAnswer(round, selectedTaxonId) {
  const selected = assertSelectedTaxon(selectedTaxonId);
  const isCorrect = selected === String(round.correctTaxonId);

  if (round.gameMode === 'riddle') {
    if (isCorrect) {
      round.finalized = true;
      return {
        ...makeBaseRoundResult(round, 'win', {
          attemptsUsed: round.attemptsUsed,
          attemptsRemaining: Math.max(0, round.maxAttempts - round.attemptsUsed),
          roundConsumed: true,
        }),
      };
    }

    round.attemptsUsed += 1;
    const exhausted = round.attemptsUsed >= round.maxAttempts;
    round.finalized = exhausted;
    return {
      ...makeBaseRoundResult(round, exhausted ? 'lose' : 'retry', {
        attemptsUsed: round.attemptsUsed,
        attemptsRemaining: Math.max(0, round.maxAttempts - round.attemptsUsed),
        roundConsumed: exhausted,
      }),
    };
  }

  round.finalized = true;
  return {
    ...makeBaseRoundResult(round, isCorrect ? 'win' : 'lose', {
      attemptsUsed: isCorrect ? 0 : 1,
      attemptsRemaining: 0,
      roundConsumed: true,
    }),
  };
}

export async function submitRoundAnswer({
  roundId,
  roundSignature,
  clientId,
  roundAction,
  selectedTaxonId,
  stepIndex,
  submissionId,
  logger,
  requestId,
}) {
  const round = getRound(roundId);

  if (!verifyRoundSignature(round, roundSignature, clientId)) {
    const err = new Error('Invalid round signature.');
    err.status = 403;
    err.code = 'INVALID_ROUND_SIGNATURE';
    throw err;
  }

  const action = resolveRoundAction(round.gameMode, roundAction);
  const dedupeBase = `${action}:${String(selectedTaxonId || '')}:${Number.isInteger(stepIndex) ? stepIndex : ''}`;
  const dedupeKey = `${round.roundId}|${String(submissionId || dedupeBase)}`;
  const deduped = submissionDedupCache.get(dedupeKey);
  if (deduped) {
    return toRoundPublicResult(deduped);
  }

  if (round.finalized && round.lastResult) {
    return toRoundPublicResult(round.lastResult);
  }

  let result;
  if (action === 'answer') {
    result = processEasyOrRiddleAnswer(round, selectedTaxonId);
  } else if (action === 'hard_guess') {
    result = await processHardGuess(round, selectedTaxonId, { logger, requestId });
  } else if (action === 'hard_hint') {
    result = processHardHint(round);
  } else if (action === 'taxonomic_select') {
    result = processTaxonomicSelect(round, selectedTaxonId, stepIndex);
  } else if (action === 'taxonomic_hint') {
    result = processTaxonomicHint(round, stepIndex);
  } else {
    const err = new Error('Unknown round action.');
    err.status = 400;
    err.code = 'BAD_REQUEST';
    throw err;
  }

  round.lastResult = result;
  roundCache.set(String(round.roundId), round);
  submissionDedupCache.set(dedupeKey, result);
  trackRoundOutcome(round, result);

  return toRoundPublicResult(result);
}
