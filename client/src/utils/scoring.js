import {
  EASY_BASE_POINTS,
  RIDDLE_BASE_POINTS,
  HARD_GUESS_BONUS,
  HARD_BASE_POINTS,
  MASTERY_THRESHOLD,
  SCORE_PER_RANK,
} from '../../../shared/scoring.js';

export {
  EASY_BASE_POINTS,
  RIDDLE_BASE_POINTS,
  HARD_GUESS_BONUS,
  HARD_BASE_POINTS,
  MASTERY_THRESHOLD,
  SCORE_PER_RANK,
};

/**
 * Compute score and bonus for a round depending on game mode.
 * @param {Object} params
 * @param {'easy'|'hard'} params.mode - Game mode.
 * @param {boolean} [params.isCorrect=false] - Whether the question was answered correctly.
 * @param {number} [params.basePoints=0] - Base points earned in the round (used in hard mode).
 * @param {number} [params.guessesRemaining=0] - Remaining guesses (used in hard mode for bonus).
 * @returns {{points: number, bonus: number}}
 */
export function computeScore({
  mode,
  isCorrect = false,
  basePoints = 0,
  guessesRemaining = 0
}) {
  let points = 0;
  let bonus = 0;

  if (mode === 'easy') {
    points = isCorrect ? EASY_BASE_POINTS : 0;
  } else if (mode === 'hard') {
    points = isCorrect ? basePoints : 0;
    if (isCorrect) {
      bonus = guessesRemaining * HARD_GUESS_BONUS;
    }
  }

  return { points, bonus };
}

/**
 * Compute linear in-game streak bonus points.
 * Simple: +2 per consecutive correct answer, capped at +20.
 * 
 * @param {number} streak - Current streak value
 * @returns {number} Bonus points for the streak
 */
export function computeInGameStreakBonus(streak) {
  if (streak <= 0) return 0;
  // +2 per streak answer, cap at +20 (streak 10)
  return Math.min(streak * 2, 20);
}

/**
 * Get level from XP.
 * FIX #6: Handle edge cases for negative XP and level 0.
 * 
 * @param {number} xp - Total XP
 * @returns {number} Current level (minimum 1)
 */
export const getLevelFromXp = (xp) => {
  // Handle edge cases: negative XP, NaN, or invalid values
  const safeXP = Number.isFinite(xp) && xp >= 0 ? xp : 0;
  return 1 + Math.floor(Math.sqrt(safeXP) / 10);
};

/**
 * Get XP required for a specific level.
 * FIX #6: Handle edge cases for level 0 and negative levels.
 * 
 * @param {number} level - Target level
 * @returns {number} XP required to reach that level
 */
export const getXpForLevel = (level) => {
  // Handle edge cases: negative level, NaN, or invalid values
  if (!Number.isFinite(level) || level <= 1) return 0;
  return Math.pow((level - 1) * 10, 2);
};

export default computeScore;
