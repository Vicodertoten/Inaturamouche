// src/core/achievements/definitions.js
// Achievement evaluation engine — data loaded from JSON.
import { getLevelFromXp } from '../../utils/scoring';
import data from './achievements.data.json';

/**
 * @typedef {'XP_FLAT' | 'PERM_MULTIPLIER' | 'TITLE' | 'BORDER'} RewardType
 *
 * @typedef {Object} AchievementReward
 * @property {RewardType} type
 * @property {number|string} value
 * @property {string} [filter]
 *
 * @typedef {Object} Achievement
 * @property {string} titleKey
 * @property {string} descriptionKey
 * @property {'TAXONOMY' | 'COLLECTION' | 'SKILL' | 'HABIT'} [category]
 * @property {string} [icon]
 * @property {AchievementReward} [reward]
 */

// Re-export frozen data from JSON
export const REWARD_TYPES = Object.freeze(data.rewardTypes);
export const ACHIEVEMENT_CATEGORIES = Object.freeze(data.categories);
export const AVAILABLE_BORDERS = Object.freeze(data.borders);
export const AVAILABLE_TITLES = Object.freeze(data.titles);
export const ICONIC_TAXON_MAP = Object.freeze(data.iconicTaxonMap);
export const TAXON_GROUP_FILTERS = Object.freeze(data.taxonGroupFilters);

/** @type {Record<string, Achievement>} */
export const ACHIEVEMENTS = Object.freeze(data.achievements);

// ============================================
// LOGIQUE DE VÉRIFICATION DES SUCCÈS
// ============================================

/**
 * Vérifie si un succès profile-based doit être débloqué
 */
export const checkNewAchievements = (profile, collectionStats = {}) => {
  const unlocked = [];
  const { xp, achievements = [], dailyStreak = {} } = profile || {};
  const baseStats = profile?.stats || {};
  const validatedStats = baseStats?.validated || null;
  const stats = validatedStats
    ? {
        ...baseStats,
        ...validatedStats,
        packsPlayed: validatedStats.packsPlayed || baseStats.packsPlayed || {},
        speciesMastery: validatedStats.speciesMastery || baseStats.speciesMastery || {},
        rarityCounts: validatedStats.rarityCounts || baseStats.rarityCounts || {},
      }
    : baseStats;
  const owned = new Set(achievements);
  const currentLevel = getLevelFromXp(xp || 0);

  // --- HABIT ---
  const gamesPlayed = stats?.gamesPlayed || 0;
  if (gamesPlayed >= 1 && !owned.has('first_game')) unlocked.push('first_game');
  if (gamesPlayed >= 10 && !owned.has('ten_games')) unlocked.push('ten_games');
  if (gamesPlayed >= 50 && !owned.has('GAMES_50')) unlocked.push('GAMES_50');

  if (stats?.weekendWarriorCompleted && !owned.has('WEEKEND_WARRIOR')) {
    unlocked.push('WEEKEND_WARRIOR');
  }

  const dailyStreakCurrent = dailyStreak?.current || 0;
  if (dailyStreakCurrent >= 7 && !owned.has('WEEKLY_RITUAL_7')) unlocked.push('WEEKLY_RITUAL_7');

  const reviewSessionsCompleted = stats?.reviewSessionsCompleted || 0;
  if (reviewSessionsCompleted >= 1 && !owned.has('FIRST_REVIEW')) unlocked.push('FIRST_REVIEW');

  // --- SKILL ---
  if (currentLevel >= 5 && !owned.has('LEVEL_5')) unlocked.push('LEVEL_5');
  if (currentLevel >= 10 && !owned.has('LEVEL_10')) unlocked.push('LEVEL_10');

  const longestStreak = stats?.longestStreak || 0;
  if (longestStreak >= 3 && !owned.has('STREAK_STARTER_3')) unlocked.push('STREAK_STARTER_3');
  if (longestStreak >= 5 && !owned.has('STREAK_MASTER_5')) unlocked.push('STREAK_MASTER_5');
  if (longestStreak >= 10 && !owned.has('STREAK_LEGEND_10')) unlocked.push('STREAK_LEGEND_10');

  const hardAnswered = stats?.hardQuestionsAnswered || 0;
  const correctHard = stats?.correctHard || 0;
  if (
    hardAnswered >= 25 &&
    (correctHard / hardAnswered) >= 0.75 &&
    !owned.has('ACCURACY_HARD_75')
  ) {
    unlocked.push('ACCURACY_HARD_75');
  }

  const correctRiddle = stats?.correctRiddle || 0;
  if (correctRiddle >= 10 && !owned.has('RIDDLE_SOLVER_10')) unlocked.push('RIDDLE_SOLVER_10');

  const masteredSpeciesCount = Object.values(stats?.speciesMastery || {}).filter(
    (m) => (m.correct || 0) >= 3
  ).length;
  if (masteredSpeciesCount >= 5 && !owned.has('MASTER_5_SPECIES')) unlocked.push('MASTER_5_SPECIES');

  // --- COLLECTION ---
  if (Object.keys(stats?.packsPlayed || {}).length >= 3 && !owned.has('globetrotter')) {
    unlocked.push('globetrotter');
  }

  const pokedexCount = collectionStats?.totalSpeciesSeen || 0;
  if (pokedexCount >= 50 && !owned.has('COLL_ROOKIE_50')) unlocked.push('COLL_ROOKIE_50');
  if (pokedexCount >= 150 && !owned.has('COLL_EXPERT_150')) unlocked.push('COLL_EXPERT_150');

  const maxMasteryCount = collectionStats?.diamondMasteryCount || 0;
  if (maxMasteryCount >= 10 && !owned.has('MASTERY_PROFESSOR_10')) unlocked.push('MASTERY_PROFESSOR_10');

  const packsPlayedCount = Object.keys(stats?.packsPlayed || {}).length;
  if (packsPlayedCount >= 5 && !owned.has('PACK_EXPLORER_5')) unlocked.push('PACK_EXPLORER_5');

  const rarityCounts = stats?.rarityCounts || {};
  const legendaryFound = rarityCounts.legendary || 0;
  if (legendaryFound >= 3 && !owned.has('RARITY_LEGEND_HUNTER_3')) unlocked.push('RARITY_LEGEND_HUNTER_3');

  // --- TAXONOMY ---
  const taxCounts = collectionStats?.taxonomyCounts || {};
  if ((taxCounts.Aves || 0) >= 50 && !owned.has('SPEC_ORNITHOLOGIST')) unlocked.push('SPEC_ORNITHOLOGIST');
  if ((taxCounts.Plantae || 0) >= 50 && !owned.has('SPEC_BOTANIST')) unlocked.push('SPEC_BOTANIST');
  if ((taxCounts.Fungi || 0) >= 20 && !owned.has('SPEC_MYCOLOGIST')) unlocked.push('SPEC_MYCOLOGIST');

  return unlocked;
};

// ============================================
// VÉRIFICATION MICRO-CHALLENGES (temps réel)
// ============================================

/**
 * Évalue les micro-challenges en temps réel pendant une session
 */
export const evaluateMicroChallenges = (snapshot = {}, alreadyUnlocked = []) => {
  const unlocked = [];
  const owned = new Set(alreadyUnlocked || []);
  const sessionSpeciesData = (snapshot.sessionSpeciesData || []).filter(
    (entry) => entry?.validatedEvent === true
  );
  const roundMeta = snapshot.roundMeta || {};
  const consecutiveFastAnswers = snapshot.consecutiveFastAnswers || 0;
  const sessionXP = snapshot.sessionXP || 0;
  const totalQuestionsAnswered = snapshot.totalQuestionsAnswered || sessionSpeciesData.length;
  const hintsUsedInSession = snapshot.hintsUsedInSession || 0;
  const correctAnswersInSession = snapshot.correctAnswersInSession || sessionSpeciesData.filter(e => e.wasCorrect).length;

  // SPEED_LIGHTNING: 5 réponses < 1.5s consécutives
  if (!owned.has('SPEED_LIGHTNING') && consecutiveFastAnswers >= 5) {
    unlocked.push('SPEED_LIGHTNING');
  }

  // SCORING_JACKPOT: 2000 XP en une partie
  if (!owned.has('SCORING_JACKPOT') && sessionXP >= 2000) {
    unlocked.push('SCORING_JACKPOT');
  }

  // PERFECT_GAME: 5 questions sans erreur (sans bouclier)
  if (!owned.has('PERFECT_GAME')) {
    const { shieldsUsed = 0 } = snapshot;
    if (
      totalQuestionsAnswered >= 5 &&
      correctAnswersInSession === totalQuestionsAnswered &&
      shieldsUsed === 0
    ) {
      unlocked.push('PERFECT_GAME');
    }
  }

  // FLAWLESS_HARD: 10 questions en mode difficile sans erreur ni bouclier
  if (!owned.has('FLAWLESS_HARD')) {
    const { gameMode = 'easy', shieldsUsed = 0 } = snapshot;
    if (
      gameMode === 'hard' &&
      totalQuestionsAnswered >= 10 &&
      correctAnswersInSession === totalQuestionsAnswered &&
      shieldsUsed === 0
    ) {
      unlocked.push('FLAWLESS_HARD');
    }
  }

  return unlocked;
};

/**
 * Vérifie les succès à la fin d'une partie
 */
export const checkEndOfGameAchievements = (sessionData = {}, alreadyUnlocked = []) => {
  const unlocked = [];
  const owned = new Set(alreadyUnlocked || []);

  const {
    sessionXP = 0,
    gameHour = new Date().getHours(),
    totalQuestions = 0,
    correctAnswers = 0,
    hintsUsed = 0,
    shieldsUsed = 0,
    gameMode = 'easy',
    gameWon = false,
    hadErrorBeforeLast5 = false,
    last5AllCorrect = false,
  } = sessionData;

  // SCORING_JACKPOT
  if (!owned.has('SCORING_JACKPOT') && sessionXP >= 2000) {
    unlocked.push('SCORING_JACKPOT');
  }

  // EARLY_BIRD
  if (!owned.has('EARLY_BIRD') && gameHour >= 5 && gameHour < 8 && gameWon) {
    unlocked.push('EARLY_BIRD');
  }

  // NIGHT_OWL
  if (!owned.has('NIGHT_OWL') && gameHour >= 0 && gameHour < 4 && gameWon) {
    unlocked.push('NIGHT_OWL');
  }

  // PERFECT_GAME
  if (
    !owned.has('PERFECT_GAME') &&
    totalQuestions >= 5 &&
    correctAnswers === totalQuestions &&
    shieldsUsed === 0
  ) {
    unlocked.push('PERFECT_GAME');
  }

  // FLAWLESS_HARD
  if (
    !owned.has('FLAWLESS_HARD') &&
    gameMode === 'hard' &&
    totalQuestions >= 10 &&
    correctAnswers === totalQuestions &&
    shieldsUsed === 0
  ) {
    unlocked.push('FLAWLESS_HARD');
  }

  // RECOVERY_KING: 100% sur les 5 dernières questions après une erreur
  if (!owned.has('RECOVERY_KING') && hadErrorBeforeLast5 && last5AllCorrect) {
    unlocked.push('RECOVERY_KING');
  }

  return unlocked;
};
